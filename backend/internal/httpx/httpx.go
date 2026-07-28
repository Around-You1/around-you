// Package httpx adapts the existing Encore-style handler functions
// (func(ctx, *Req) (*Resp, error)) onto the standard net/http server.
//
// Each handler is registered through one of three generic wrappers depending
// on where its input comes from — a JSON body, URL query parameters, or
// nothing at all — mirroring exactly what the Encore framework used to infer
// from the request struct's `json:` / `query:` tags. Responses are JSON, and a
// returned *errs.Error becomes the matching HTTP status plus a
// {"code","message"} body, preserving the wire contract the frontend expects.
package httpx

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"strconv"

	"backend_encore/internal/errs"
)

// Body wraps a handler whose request is decoded from the JSON request body.
// Used for POST/PUT/DELETE endpoints.
func Body[Req any, Resp any](fn func(context.Context, *Req) (*Resp, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req Req
		if r.Body != nil && r.ContentLength != 0 {
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writeErr(w, &errs.Error{Code: errs.InvalidArgument, Message: "invalid JSON body: " + err.Error()})
				return
			}
		}
		resp, err := fn(r.Context(), &req)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// Query wraps a handler whose request is decoded from URL query parameters
// (fields tagged `query:"..."`). Used for GET endpoints that take arguments.
func Query[Req any, Resp any](fn func(context.Context, *Req) (*Resp, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req Req
		if err := decodeQuery(&req, r); err != nil {
			writeErr(w, &errs.Error{Code: errs.InvalidArgument, Message: err.Error()})
			return
		}
		resp, err := fn(r.Context(), &req)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// Empty wraps a handler that takes no request payload.
func Empty[Resp any](fn func(context.Context) (*Resp, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp, err := fn(r.Context())
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// decodeQuery populates the `query:"..."`-tagged fields of req from the
// request's URL query string. Supports string, bool, integer, and float
// fields — the only kinds the request structs use.
func decodeQuery(req any, r *http.Request) error {
	values := r.URL.Query()
	v := reflect.ValueOf(req).Elem()
	t := v.Type()

	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		tag := field.Tag.Get("query")
		if tag == "" || tag == "-" {
			continue
		}
		raw := values.Get(tag)
		if raw == "" {
			continue
		}

		fv := v.Field(i)
		switch fv.Kind() {
		case reflect.String:
			fv.SetString(raw)
		case reflect.Bool:
			b, err := strconv.ParseBool(raw)
			if err != nil {
				return errors.New("invalid boolean for query param " + tag)
			}
			fv.SetBool(b)
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			n, err := strconv.ParseInt(raw, 10, 64)
			if err != nil {
				return errors.New("invalid integer for query param " + tag)
			}
			fv.SetInt(n)
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			n, err := strconv.ParseUint(raw, 10, 64)
			if err != nil {
				return errors.New("invalid integer for query param " + tag)
			}
			fv.SetUint(n)
		case reflect.Float32, reflect.Float64:
			f, err := strconv.ParseFloat(raw, 64)
			if err != nil {
				return errors.New("invalid number for query param " + tag)
			}
			fv.SetFloat(f)
		}
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// writeErr renders any error as a JSON body. *errs.Error carries an explicit
// code/status; anything else is treated as an internal server error.
func writeErr(w http.ResponseWriter, err error) {
	code := errs.Internal
	msg := err.Error()

	var e *errs.Error
	if errors.As(err, &e) {
		code = e.Code
		msg = e.Message
	}

	writeJSON(w, errs.HTTPStatus(code), map[string]string{
		"code":    errs.CodeString(code),
		"message": msg,
	})
}

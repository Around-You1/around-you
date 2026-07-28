// Package errs is a small, dependency-free replacement for encore.dev/beta/errs.
//
// It keeps the exact surface the handlers already use — an *Error value built
// with a Code and a Message (e.g. &errs.Error{Code: errs.NotFound, Message:
// "..."}) — so removing Encore didn't require touching any handler body. The
// only change at the call sites was the import path.
//
// The router (internal/httpx) turns a returned *Error into an HTTP status +
// JSON body of the form {"code": "...", "message": "..."}, matching the shape
// Encore produced so the frontend's error handling keeps working unchanged.
package errs

import "net/http"

// ErrCode enumerates the error classes the handlers raise. Only the values
// actually used by the codebase are defined (plus Internal/OK as sensible
// defaults).
type ErrCode int

const (
	OK ErrCode = iota
	Internal
	InvalidArgument
	NotFound
	Unauthenticated
	PermissionDenied
	AlreadyExists
)

// Error is the concrete error type handlers return. It mirrors
// encore.dev/beta/errs.Error's Code/Message fields.
type Error struct {
	Code    ErrCode `json:"code"`
	Message string  `json:"message"`
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

// CodeString returns the snake_case string form of a code, matching the
// identifiers Encore used on the wire.
func CodeString(c ErrCode) string {
	switch c {
	case OK:
		return "ok"
	case InvalidArgument:
		return "invalid_argument"
	case NotFound:
		return "not_found"
	case Unauthenticated:
		return "unauthenticated"
	case PermissionDenied:
		return "permission_denied"
	case AlreadyExists:
		return "already_exists"
	default:
		return "internal"
	}
}

// HTTPStatus maps a code to the HTTP status the router should send.
func HTTPStatus(c ErrCode) int {
	switch c {
	case OK:
		return http.StatusOK
	case InvalidArgument:
		return http.StatusBadRequest
	case NotFound:
		return http.StatusNotFound
	case Unauthenticated:
		return http.StatusUnauthorized
	case PermissionDenied:
		return http.StatusForbidden
	case AlreadyExists:
		return http.StatusConflict
	default:
		return http.StatusInternalServerError
	}
}

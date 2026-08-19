// AI nuance layer for content moderation. When ANTHROPIC_API_KEY is set, text
// that passed the word-list is additionally sent to Anthropic's Claude for
// context-aware classification (hate / harassment / sexual / violence) that the
// static list can't catch. Results are recorded as flags for admin review — the
// AI layer never hard-blocks a save on its own (a false positive must not be
// able to reject a legitimate business). Hard-blocking stays on the
// deterministic slur/threat list in moderation.go.
//
// Dependency-free (plain net/http), best-effort, and fully gated: with no API
// key, everything here is a no-op.
package moderation

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// AIEnabled reports whether the Anthropic key is configured.
func AIEnabled() bool { return strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY")) != "" }

func aiModel() string {
	if m := strings.TrimSpace(os.Getenv("ANTHROPIC_MODEL")); m != "" {
		return m
	}
	return "claude-3-5-haiku-latest"
}

type aiVerdict struct {
	Hate       bool   `json:"hate"`
	Harassment bool   `json:"harassment"`
	Sexual     bool   `json:"sexual"`
	Violence   bool   `json:"violence"`
	Reason     string `json:"reason"`
}

// aiScreen classifies text via Claude and returns any AI-detected hits. Returns
// (nil, nil) when disabled or on any error — callers treat AI as best-effort.
func aiScreen(ctx context.Context, text string) []Hit {
	apiKey := strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))
	if apiKey == "" || strings.TrimSpace(text) == "" {
		return nil
	}

	system := "You are a content-moderation classifier for a public business directory. " +
		"Classify the USER text for policy violations. Respond with ONLY a compact JSON object, no prose, " +
		`of the form {"hate":bool,"harassment":bool,"sexual":bool,"violence":bool,"reason":"short phrase"}. ` +
		"hate = slurs or demeaning content targeting a protected group; harassment = targeted abuse or threats; " +
		"sexual = explicit sexual content; violence = incitement or graphic violence. Only set true when clearly present."

	payload, err := json.Marshal(map[string]interface{}{
		"model":      aiModel(),
		"max_tokens": 200,
		"system":     system,
		"messages": []map[string]interface{}{
			{"role": "user", "content": text},
		},
	})
	if err != nil {
		return nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(payload))
	if err != nil {
		return nil
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("moderation ai: request failed: %v", err)
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("moderation ai: status %d", resp.StatusCode)
		return nil
	}

	var out struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil
	}
	var raw string
	for _, c := range out.Content {
		if c.Type == "text" {
			raw += c.Text
		}
	}
	raw = extractJSON(raw)
	if raw == "" {
		return nil
	}
	var v aiVerdict
	if err := json.Unmarshal([]byte(raw), &v); err != nil {
		return nil
	}

	reason := strings.TrimSpace(v.Reason)
	if reason == "" {
		reason = snippet(text)
	}
	var hits []Hit
	add := func(on bool, cat string) {
		if on {
			hits = append(hits, Hit{Category: cat, Term: "AI", Snippet: reason})
		}
	}
	// Map AI categories onto our stored categories so the review UI colours them
	// the same as list hits, with an "ai:" prefix so their origin is clear.
	add(v.Hate, "ai:"+CatDiscrimination)
	add(v.Harassment, "ai:"+CatAbuse)
	add(v.Violence, "ai:"+CatAbuse)
	add(v.Sexual, "ai:"+CatProfanity)
	return hits
}

// extractJSON pulls the first {...} object out of a model reply, tolerating any
// stray text or code fences around it.
func extractJSON(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start < 0 || end < 0 || end < start {
		return ""
	}
	return s[start : end+1]
}

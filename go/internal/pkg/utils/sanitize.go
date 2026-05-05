package utils

import (
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

var (
	reScriptStyle  = regexp.MustCompile(`(?i)<(?:script|style)[\s\S]*?</(?:script|style)>`)
	reEventHandler = regexp.MustCompile(`(?i)\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)`)
	reDangerousTags = regexp.MustCompile(`(?i)</?(?:iframe|object|embed|frame|meta|link|base|form|input)\b[^>]*>`)
)

// bluemonday 策略实例（用于 Markdown 输出后的 HTML 净化）
var htmlPolicy = bluemonday.UGCPolicy()

func init() {
	// 允许 Markdown 常用的标签和属性
	htmlPolicy.AllowAttrs("href", "target", "rel").OnElements("a")
	htmlPolicy.AllowAttrs("src", "alt", "title").OnElements("img")
	htmlPolicy.AllowAttrs("class").OnElements("code", "pre", "span", "div")
}

// CheckContent sanitizes raw user input for plain-text fields (author, url, etc.)
// Removes XSS attack vectors before markdown processing
func CheckContent(content string) string {
	content = reScriptStyle.ReplaceAllString(content, "")
	content = reEventHandler.ReplaceAllString(content, "")
	content = reDangerousTags.ReplaceAllString(content, "")
	return content
}

// SanitizeHtml 使用 bluemonday 净化已渲染的 HTML 内容（Markdown 输出后使用）
func SanitizeHtml(html string) string {
	return htmlPolicy.Sanitize(html)
}

// HTML escape for email template injection defense
func HtmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
}

package utils

import (
	"github.com/gomarkdown/markdown"
)

func ParseMarkdown(content string) string {
	if content == "" {
		return ""
	}
	// Parse markdown to HTML
	result := markdown.ToHTML([]byte(content), nil, nil)
	html := string(result)

	// Use bluemonday to sanitize the HTML output
	return SanitizeHtml(html)
}

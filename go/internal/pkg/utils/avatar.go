package utils

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
)

var qqEmailRe = regexp.MustCompile(`^(\d{5,11})@qq\.com$`)

// GetCravatar 生成 Cravatar/Gravatar 头像地址
func GetCravatar(email string) string {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))

	if match := qqEmailRe.FindStringSubmatch(cleanEmail); match != nil {
		return fmt.Sprintf("https://q1.qlogo.cn/g?b=qq&nk=%s&s=100", match[1])
	}

	hash := md5.Sum([]byte(cleanEmail))
	hashHex := hex.EncodeToString(hash[:])
	return fmt.Sprintf("https://gravatar.loli.net/avatar/%s?d=identicon&s=100", hashHex)
}

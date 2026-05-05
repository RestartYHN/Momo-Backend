package utils

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"strings"
)

// GetCravatar 生成 Cravatar/Gravatar 头像地址
func GetCravatar(email string) string {
	// 1. 处理 Email
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	hash := md5.Sum([]byte(cleanEmail))
	hashHex := hex.EncodeToString(hash[:])

	// avatar 地址
	avatarURL := fmt.Sprintf("https://open.motues.top/avatar?name=%s&mode=cravatar&variant=beam", hashHex)

	return avatarURL
}

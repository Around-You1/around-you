// Command hashpassword turns a password into a bcrypt hash, entirely on
// your own machine. The password you type is never sent anywhere — not to
// the database, not to Fly.io, not into any chat. Only the resulting hash
// (which cannot be reversed back into the original password) is meant to be
// shared, e.g. to set up an admin account via a migration.
//
// Usage (run from D:\1au\backend):
//
//	go run ./cmd/hashpassword
//
// It will ask you to type a password (it will be visible as you type — this
// is a plain terminal prompt, not a masked one — so make sure nobody's
// looking over your shoulder), then print a hash. Copy that hash and send
// it back; do not send the password itself anywhere.
package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Enter the password to hash (this stays on your screen only): ")
	password, _ := reader.ReadString('\n')
	password = strings.TrimSpace(password)

	if password == "" {
		fmt.Println("No password entered — nothing to hash.")
		os.Exit(1)
	}
	if len(password) < 8 {
		fmt.Println("Warning: that's a short password for an account with full admin access. Consider something longer.")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Println("Error generating hash:", err)
		os.Exit(1)
	}

	fmt.Println()
	fmt.Println("Copy everything between the lines below and send that back (NOT the password itself):")
	fmt.Println("--------------------------------------------------------------------")
	fmt.Println(string(hash))
	fmt.Println("--------------------------------------------------------------------")
}

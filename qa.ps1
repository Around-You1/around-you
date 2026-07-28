Write-Host "=== Validate() call sites ==="
git --no-pager grep -n "Validate("

Write-Host "`n=== issueSession() call sites ==="
git --no-pager grep -n "issueSession("

Write-Host "`n=== findLocalGuestByEmail() call sites ==="
git --no-pager grep -n "findLocalGuestByEmail("

Write-Host "`n=== In-memory Sessions/Users references ==="
git --no-pager grep -F "appdb.DB.Sessions[" -- 'app/*.go' 'internal/**/*.go' 'store/*.go' 'cmd/**/*.go'
git --no-pager grep -F "appdb.DB.Users[" -- 'app/*.go' 'internal/**/*.go' 'store/*.go' 'cmd/**/*.go'
git --no-pager grep -F "Sessions[" -- 'app/*.go' 'internal/**/*.go' 'store/*.go' 'cmd/**/*.go'

Write-Host "`n=== COALESCE / SQL alias checks ==="
git --no-pager grep -n "COALESCE("
git --no-pager grep -n "postal_code"
git --no-pager grep -n "profile_reference_code"
git --no-pager grep -n "image_urls"

Write-Host "`n=== Build ==="
go build ./...

Write-Host "`n=== Vet ==="
go vet ./...

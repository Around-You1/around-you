$Base = "http://localhost:4000"

function Call-API {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = $null
    )

    try {
        $headers = @{}
        if ($Token) {
            $headers["Authorization"] = $Token
        }

        if ($Body -ne $null) {
            $json = $Body | ConvertTo-Json -Depth 10
            $resp = Invoke-WebRequest -Method $Method -Uri "$Base$Path" -Body $json -ContentType "application/json" -Headers $headers -UseBasicParsing
        } else {
            $resp = Invoke-WebRequest -Method $Method -Uri "$Base$Path" -Headers $headers -UseBasicParsing
        }

        return @{
            Status = $resp.StatusCode
            Body   = ($resp.Content | ConvertFrom-Json)
        }
    }
    catch {
        try {
            $status = $_.Exception.Response.StatusCode.value__
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $text = $reader.ReadToEnd()
            return @{
                Status = $status
                Body   = ($text | ConvertFrom-Json)
            }
        } catch {
            return @{
                Status = 0
                Body   = @{ error = "Unhandled exception" }
            }
        }
    }
}

$Global:FailureCount = 0

function Assert {
    param(
        [string]$Name,
        [bool]$Condition
    )

    if ($Condition) {
        Write-Host "[PASS] $Name" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        $Global:FailureCount++
    }
}

function Test-Health {
    $r = Call-API -Method GET -Path "/ping"
    Assert "Health /ping returns 200" ($r.Status -eq 200)
}

function Test-Auth {
    # LocalGuestLoginRequest requires ALL FOUR of these — email, province,
    # area, postalCode — or the server 400s and no token comes back. The
    # previous version only sent `name` (not even a real field on this
    # struct), so $Global:Token was always garbage and every test below
    # was failing on 401 regardless of whether the server had restarted.
    $r = Call-API -Method POST -Path "/auth/local-guest-login" -Body @{
        email      = "guest@example.com"
        province   = "Western Cape"
        area       = "Mitchells Plain"
        postalCode = "7785"
    }

    Assert "Local guest login returns 200" ($r.Status -eq 200)

    $Global:Token = "Bearer " + $r.Body.token
    Assert "Token returned" ($r.Body.token -ne $null -and $r.Body.token -ne "")
}

function Test-Accommodation {
    # latitude/longitude (not lat/lng), province is required (not phone,
    # which isn't a field on this request at all).
    $create = Call-API -Method POST -Path "/accommodation" -Body @{
        name       = "Test Lodge"
        address    = "123 Road"
        latitude   = -34.0
        longitude  = 18.5
        province   = "Western Cape"
        area       = "Mitchells Plain"
        postalCode = "7785"
    } -Token $Global:Token

    Assert "Accommodation create 200" ($create.Status -eq 200)
    $id = $create.Body.id

    $get = Call-API -Method GET -Path "/accommodation/get?id=$id" -Token $Global:Token
    Assert "Accommodation get 200" ($get.Status -eq 200)

    $update = Call-API -Method PUT -Path "/accommodation" -Body @{
        id   = $id
        name = "Updated Lodge"
    } -Token $Global:Token

    Assert "Accommodation update 200" ($update.Status -eq 200)

    $del = Call-API -Method DELETE -Path "/accommodation" -Body @{ id = $id } -Token $Global:Token
    Assert "Accommodation delete 200" ($del.Status -eq 200)
}

function Test-Restaurant {
    # cuisineTypes is a string ARRAY field — `cuisine` isn't a field at all
    # and would silently be ignored (not error), which is worse than a loud
    # failure since it masks that the update never did anything real.
    $create = Call-API -Method POST -Path "/restaurant" -Body @{
        name         = "Test Restaurant"
        address      = "1 Harbour St"
        latitude     = -34.1
        longitude    = 18.4
        province     = "Western Cape"
        cuisineTypes = @("Seafood")
    } -Token $Global:Token

    Assert "Restaurant create 200" ($create.Status -eq 200)
    $id = $create.Body.id

    $get = Call-API -Method GET -Path "/restaurant/get?id=$id" -Token $Global:Token
    Assert "Restaurant get 200" ($get.Status -eq 200)

    $update = Call-API -Method PUT -Path "/restaurant" -Body @{
        id           = $id
        cuisineTypes = @("Grill")
    } -Token $Global:Token

    Assert "Restaurant update 200" ($update.Status -eq 200)

    $del = Call-API -Method DELETE -Path "/restaurant" -Body @{ id = $id } -Token $Global:Token
    Assert "Restaurant delete 200" ($del.Status -eq 200)
}

function Test-Service {
    # Service is keyed by a STRING serviceId, not the numeric id — every
    # get/update/delete call below uses serviceId, matching
    # `query:"serviceId"` / `json:"serviceId"` on the actual request structs.
    $create = Call-API -Method POST -Path "/service" -Body @{
        name              = "Test Service"
        address           = "1 Jetty Rd"
        province          = "Western Cape"
        serviceCategories = @("Transport")
    } -Token $Global:Token

    Assert "Service create 200" ($create.Status -eq 200)
    $serviceId = $create.Body.serviceId

    $get = Call-API -Method GET -Path "/service/get?serviceId=$serviceId" -Token $Global:Token
    Assert "Service get 200" ($get.Status -eq 200)

    $update = Call-API -Method PUT -Path "/service" -Body @{
        serviceId         = $serviceId
        serviceCategories = @("Tours")
    } -Token $Global:Token

    Assert "Service update 200" ($update.Status -eq 200)

    $del = Call-API -Method DELETE -Path "/service" -Body @{ serviceId = $serviceId } -Token $Global:Token
    Assert "Service delete 200" ($del.Status -eq 200)
}

function Test-Attraction {
    # Same string-identifier pattern as Service, but attractionId.
    $create = Call-API -Method POST -Path "/attraction" -Body @{
        name           = "Test Attraction"
        address        = "Lighthouse Rd"
        province       = "Western Cape"
        attractionType = @("Nature")
    } -Token $Global:Token

    Assert "Attraction create 200" ($create.Status -eq 200)
    $attractionId = $create.Body.attractionId

    $get = Call-API -Method GET -Path "/attraction/get?attractionId=$attractionId" -Token $Global:Token
    Assert "Attraction get 200" ($get.Status -eq 200)

    $update = Call-API -Method PUT -Path "/attraction" -Body @{
        attractionId   = $attractionId
        attractionType = @("Adventure")
    } -Token $Global:Token

    Assert "Attraction update 200" ($update.Status -eq 200)

    $del = Call-API -Method DELETE -Path "/attraction" -Body @{ attractionId = $attractionId } -Token $Global:Token
    Assert "Attraction delete 200" ($del.Status -eq 200)
}

function Test-Stats {
    $r = Call-API -Method GET -Path "/stats" -Token $Global:Token
    Assert "Stats returns 200" ($r.Status -eq 200)
}

function Test-Errors {
    $r = Call-API -Method GET -Path "/accommodation/get?id=999999" -Token $Global:Token
    Assert "404 returns correct status" ($r.Status -eq 404)
}

Write-Host "=== Phase 9B Runtime QA ===" -ForegroundColor Cyan

Test-Health
Test-Auth
Test-Accommodation
Test-Restaurant
Test-Service
Test-Attraction
Test-Stats
Test-Errors

Write-Host "=== Phase 9B Complete ===" -ForegroundColor Cyan

if ($Global:FailureCount -gt 0) {
    Write-Host "$($Global:FailureCount) assertion(s) failed." -ForegroundColor Red
    exit 1
}
exit 0

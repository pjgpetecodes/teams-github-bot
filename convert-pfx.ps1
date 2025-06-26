# PowerShell script to convert PFX to PEM using Windows certificate store
# This script helps convert the PFX certificate for use with Node.js

param(
    [string]$PfxPath = ".\graphwebhook.pfx",
    [string]$PemPath = ".\graphwebhook.pem",
    [string]$Password = ""
)

Write-Host "Converting PFX to PEM format..."
Write-Host "PFX Path: $PfxPath"
Write-Host "PEM Path: $PemPath"

try {
    # Method 1: Try using .NET certificate classes
    Add-Type -AssemblyName System.Security
    
    # Try loading with empty password first, then prompt if needed
    $cert = $null
    $attempts = @("", "password", "cert", "graphwebhook", "webhook")
    
    foreach ($pwd in $attempts) {
        try {
            Write-Host "Trying password: '$pwd'"
            $securePassword = ConvertTo-SecureString $pwd -AsPlainText -Force
            $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($PfxPath, $securePassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
            Write-Host "Success with password: '$pwd'"
            break
        }
        catch {
            Write-Host "Failed with password '$pwd': $($_.Exception.Message)"
        }
    }
    
    if ($cert -eq $null) {
        Write-Host "All password attempts failed. Please enter the PFX password manually:"
        $securePassword = Read-Host "Enter PFX password" -AsSecureString
        $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($PfxPath, $securePassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
    }
    
    # Export the certificate and private key
    $pemContent = ""
    
    # Export private key
    $privateKey = $cert.PrivateKey
    if ($privateKey) {
        $privateKeyBytes = $privateKey.ExportPkcs8PrivateKey()
        $privateKeyBase64 = [Convert]::ToBase64String($privateKeyBytes)
        $pemContent += "-----BEGIN PRIVATE KEY-----`n"
        for ($i = 0; $i -lt $privateKeyBase64.Length; $i += 64) {
            $line = $privateKeyBase64.Substring($i, [Math]::Min(64, $privateKeyBase64.Length - $i))
            $pemContent += "$line`n"
        }
        $pemContent += "-----END PRIVATE KEY-----`n"
    }
    
    # Export certificate
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $certBase64 = [Convert]::ToBase64String($certBytes)
    $pemContent += "-----BEGIN CERTIFICATE-----`n"
    for ($i = 0; $i -lt $certBase64.Length; $i += 64) {
        $line = $certBase64.Substring($i, [Math]::Min(64, $certBase64.Length - $i))
        $pemContent += "$line`n"
    }
    $pemContent += "-----END CERTIFICATE-----`n"
    
    # Save to file
    $pemContent | Out-File -FilePath $PemPath -Encoding ASCII
    Write-Host "Successfully converted PFX to PEM: $PemPath"
    
    # Display certificate info
    Write-Host "Certificate Subject: $($cert.Subject)"
    Write-Host "Certificate Thumbprint: $($cert.Thumbprint)"
    Write-Host "Certificate Valid From: $($cert.NotBefore)"
    Write-Host "Certificate Valid To: $($cert.NotAfter)"
}
catch {
    Write-Error "Failed to convert PFX: $($_.Exception.Message)"
    Write-Host "Alternative: Use OpenSSL if available:"
    Write-Host "openssl pkcs12 -in graphwebhook.pfx -out graphwebhook.pem -nodes"
}

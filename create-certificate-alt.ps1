# PowerShell script to create a self-signed certificate for Microsoft Graph webhook notifications
# This script creates both a .cer (certificate) and .pfx (private key + certificate) file

param(
    [string]$CertName = "graphwebhook",
    [string]$Subject = "CN=graphwebhook",
    [string]$Password = "",
    [int]$ValidDays = 365
)

Write-Host "Creating self-signed certificate for Microsoft Graph webhook notifications..."
Write-Host "Certificate Name: $CertName"
Write-Host "Subject: $Subject"
Write-Host "Valid for: $ValidDays days"

try {
    # Remove existing certificates with the same subject if they exist
    $existingCerts = Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $Subject }
    if ($existingCerts) {
        Write-Host "Removing existing certificates with subject '$Subject'..."
        $existingCerts | Remove-Item
    }

    # Create a self-signed certificate
    $cert = New-SelfSignedCertificate `
        -Subject $Subject `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyUsage KeyEncipherment, DataEncipherment `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -NotAfter (Get-Date).AddDays($ValidDays) `
        -HashAlgorithm SHA256 `
        -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider"

    Write-Host "Certificate created successfully!"
    Write-Host "Thumbprint: $($cert.Thumbprint)"
    Write-Host "Subject: $($cert.Subject)"
    Write-Host "Valid From: $($cert.NotBefore)"
    Write-Host "Valid To: $($cert.NotAfter)"    # Convert password to secure string
    $securePassword = if ($Password -eq "") { 
        New-Object System.Security.SecureString 
    } else { 
        ConvertTo-SecureString -String $Password -Force -AsPlainText 
    }

    # Export the certificate (public key) to a .cer file
    $cerPath = ".\$CertName.cer"
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    [System.IO.File]::WriteAllBytes($cerPath, $certBytes)
    Write-Host "Certificate exported to: $cerPath"

    # Export the certificate with private key to a .pfx file
    $pfxPath = ".\$CertName.pfx"
    $pfxBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $securePassword)
    [System.IO.File]::WriteAllBytes($pfxPath, $pfxBytes)
    Write-Host "Certificate with private key exported to: $pfxPath"

    # Display certificate details for verification
    Write-Host "`nCertificate Details:"
    Write-Host "==================="
    Write-Host "Subject: $($cert.Subject)"
    Write-Host "Issuer: $($cert.Issuer)"
    Write-Host "Serial Number: $($cert.SerialNumber)"
    Write-Host "Thumbprint: $($cert.Thumbprint)"
    Write-Host "Has Private Key: $($cert.HasPrivateKey)"
    Write-Host "Key Algorithm: $($cert.PublicKey.Oid.FriendlyName)"
    Write-Host "Key Size: $($cert.PublicKey.Key.KeySize) bits"

    # Display the certificate in Base64 format (useful for Microsoft Graph)
    Write-Host "`nBase64 Certificate (for Microsoft Graph API):"
    Write-Host "=============================================="
    $base64Cert = [Convert]::ToBase64String($certBytes)
    Write-Host $base64Cert    Write-Host "Files created:"
    Write-Host "- $cerPath (certificate public key)"
    if ($Password -eq "") {
        Write-Host "- $pfxPath (certificate with private key, password: [empty])"
    } else {
        Write-Host "- $pfxPath (certificate with private key, password: $Password)"
    }    Write-Host "`nNEXT STEPS:"
    Write-Host "1. Use the .cer file for Microsoft Graph subscription encryption"
    Write-Host "2. Use the .pfx file in your Node.js application for decryption"
    if ($Password -eq "") {
        Write-Host "3. The password for the .pfx file is: [empty]"
    } else {
        Write-Host "3. The password for the .pfx file is: $Password"
    }
    Write-Host "4. Update your .env file with the certificate path and password"

    # Clean up - remove the certificate from the store (we have the files now)
    Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)"
    Write-Host "`nCertificate removed from certificate store (files retained)"

}
catch {
    Write-Error "Failed to create certificate: $($_.Exception.Message)"
    Write-Host "`nTroubleshooting:"
    Write-Host "1. Make sure you're running PowerShell as Administrator"
    Write-Host "2. Check if you have sufficient permissions to create certificates"
    Write-Host "3. Verify that the certificate store is accessible"
}

Write-Host "`nDone!"
# PowerShell script to fix Next.js 15 async params issues
# Run this script from the project root directory

$files = @(
    "src/app/api/recipients/[id]/route.ts",
    "src/app/api/shipments/[id]/route.ts", 
    "src/app/api/vendors/[id]/route.ts",
    "src/app/api/debit-notes/[id]/route.ts",
    "src/app/api/chart-of-accounts/[id]/route.ts",
    "src/app/api/agencies/[id]/route.ts",
    "src/app/api/accounts/transactions/vendor/[id]/route.ts",
    "src/app/api/accounts/transactions/customer/[id]/route.ts",
    "src/app/api/customers/[id]/route.ts",
    "src/app/api/offices/[id]/route.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing $file..."
        
        # Read file content
        $content = Get-Content $file -Raw
        
        # Fix params type declarations
        $content = $content -replace 'params: \{ id: string \}', 'params: Promise<{ id: string }>'
        $content = $content -replace 'params: \{ type: string \}', 'params: Promise<{ type: string }>'
        
        # Fix params usage in function bodies
        $content = $content -replace 'const (\w+)Id = parseInt\(params\.id\);', 'const { id } = await params; const $1Id = parseInt(id);'
        $content = $content -replace 'const (\w+) = await params', 'const { type } = await params'
        
        # Write back to file
        Set-Content $file $content -NoNewline
        Write-Host "Fixed $file"
    } else {
        Write-Host "File not found: $file"
    }
}

Write-Host "All files processed!"

# Directly target your AZ104_Quiz_Bank folder
$rootDir = "C:\Users\prade\Downloads\AZ104_Quiz_Bank"

# Exam structure mapping: Domains and their respective Topics
$examStructure = [ordered]@{
    "Manage Azure identities and governance" = @(
        "Manage Microsoft Entra users and groups",
        "Manage access to Azure resources",
        "Manage Azure subscriptions and governance"
    )
    "Implement and manage storage" = @(
        "Configure access to storage",
        "Configure and manage storage accounts",
        "Configure Azure Files and Azure Blob Storage"
    )
    "Deploy and manage Azure compute resources" = @(
        "Automate deployment of resources by using ARM templates or Bicep files",
        "Create and configure virtual machines",
        "Provision and manage containers in the Azure portal",
        "Create and configure Azure App Service"
    )
    "Implement and manage virtual networking" = @(
        "Configure and manage virtual networks in Azure",
        "Configure secure access to virtual networks",
        "Configure name resolution and load balancing"
    )
    "Monitor and maintain Azure resources" = @(
        "Monitor resources in Azure",
        "Implement backup and recovery"
    )
}

# Create the root folder if it doesn't exist
if (-not (Test-Path -Path $rootDir)) {
    New-Item -ItemType Directory -Path $rootDir | Out-Null
    Write-Host "Created root folder: $rootDir" -ForegroundColor Green
}

# Loop through Domains and Topics to generate folder structure
foreach ($domain in $examStructure.Keys) {
    $domainFolder = Join-Path -Path $rootDir -ChildPath $domain
    
    if (-not (Test-Path -Path $domainFolder)) {
        New-Item -ItemType Directory -Path $domainFolder | Out-Null
        Write-Host "📂 Created Domain: $domain" -ForegroundColor Cyan
    }

    foreach ($topic in $examStructure[$domain]) {
        $topicFolder = Join-Path -Path $domainFolder -ChildPath $topic
        
        if (-not (Test-Path -Path $topicFolder)) {
            New-Item -ItemType Directory -Path $topicFolder | Out-Null
            Write-Host "   └── 📁 Created Topic: $topic" -ForegroundColor Yellow
        }
    }
}

Write-Host "`nFolder structure successfully generated in $rootDir!" -ForegroundColor Green
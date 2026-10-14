#Requires -Version 5.1
<#
.SYNOPSIS
  Свързва папката с кирилица `Desktop\проект\agrinexus-final-main` с каноничното ASCII репо чрез directory junction.

.DESCRIPTION
  По подразбиране целта е `Desktop\project\agrinexus-final-main` (пълното репо). Под `проект\` често остава празно/старо копие — тогава Cursor „не вижда“ последния код.

  Затвори VS Code/Cursor, терминали и Explorer прозорци, отворени върху `...\проект\agrinexus-final-main`, после от **корена на истинското репо**:

    powershell -ExecutionPolicy Bypass -File .\scripts\windows\link-cyrillic-desktop-folder.ps1

  Друга цел (напр. `C:\Users\expre\Academy`):

    powershell -ExecutionPolicy Bypass -File .\scripts\windows\link-cyrillic-desktop-folder.ps1 -CanonicalRepoRoot "C:\Users\expre\Academy"

.NOTES
  Junction не е git submodule. OneDrive понякога се държи по-особено с junction; при проблем ползвай директно ASCII пътя.
#>

param(
	[string]$CanonicalRepoRoot = $(Join-Path ([Environment]::GetFolderPath("Desktop")) "project\agrinexus-final-main")
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$desktop = [Environment]::GetFolderPath("Desktop")
if (-not $desktop) {
	$desktop = Join-Path $env:USERPROFILE "Desktop"
}

$parentCyrillic = Join-Path $desktop "проект"
$linkPath = Join-Path $parentCyrillic "agrinexus-final-main"
$targetPath = $CanonicalRepoRoot.TrimEnd("\")

function Test-SameJunction {
	param([string]$Path, [string]$ExpectedTarget)
	if (-not (Test-Path -LiteralPath $Path)) { return $false }
	$item = Get-Item -LiteralPath $Path -Force
	if ($item.LinkType -ne "Junction") { return $false }
	$actual = $item.Target
	if ($null -eq $actual) { return $false }
	$t = if ($actual -is [string]) { $actual } else { $actual[0] }
	return ([string]$t).TrimEnd("\") -ieq $ExpectedTarget.TrimEnd("\")
}

Write-Host "Цел (истинско репо): $targetPath"
Write-Host "Връзка (кирилица):   $linkPath"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
	Write-Error "Липсва целевата папка. Очаква се: $targetPath`nПремести/клонирай репото там или подай -CanonicalRepoRoot."
	exit 2
}

if (-not (Test-Path -LiteralPath $parentCyrillic)) {
	Write-Host "Създавам родителска папка: $parentCyrillic"
	New-Item -ItemType Directory -Path $parentCyrillic -Force | Out-Null
}

if (Test-SameJunction -Path $linkPath -ExpectedTarget $targetPath) {
	Write-Host "Вече е направена junction към правилната цел. Нищо не се променя."
	exit 0
}

if (Test-Path -LiteralPath $linkPath) {
	$item = Get-Item -LiteralPath $linkPath -Force
	if ($item.LinkType -eq "Junction") {
		Write-Host "Премахвам стара junction..."
		Remove-Item -LiteralPath $linkPath -Force
	} else {
		$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
		$backupPath = Join-Path $parentCyrillic "agrinexus-final-main-backup-$stamp"
		Write-Host "Преименувам съществуващата папка в резервно копие:`n  $backupPath"
		try {
			Rename-Item -LiteralPath $linkPath -NewName (Split-Path $backupPath -Leaf)
		} catch {
			Write-Error @"
Не може да се преименува (вероятно папката е отворена в Cursor/Explorer).
Затвори всички прозорци върху тази папка и стартирай скрипта отново.

Оригинална грешка: $($_.Exception.Message)
"@
			exit 1
		}
	}
}

Write-Host "Създавам junction..."
New-Item -ItemType Junction -Path $linkPath -Target $targetPath | Out-Null
Write-Host "Готово. Пътят с кирилица вече сочи към същото репо като $targetPath"
exit 0

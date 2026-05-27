#Requires -Version 5.1
<#
.SYNOPSIS
  Прави `agrinexus-final-main\fieldlot` да сочи към същата папка като `Desktop\project\fieldlot` (directory junction).

.DESCRIPTION
  Един физически working tree за FieldLot: отваряш `...\agrinexus-final-main\fieldlot` или `...\project\fieldlot` — виждаш едни и същи файлове.

  ВАЖНО — Git submodule:
  В `.gitmodules` полето `fieldlot` е submodule. След junction папката `fieldlot` под AgriNexus съдържа `.git` на **каноничния** clone (`project\fieldlot`), не отделния gitlink на submodule.
  - `git status` в **родителя** AgriNexus може да показва променен submodule.
  - Работа с FieldLot: предпочитай `git` от `project\fieldlot` (commit/push към fieldlot.git).
  - Избягвай `git submodule update --init` в родителя, ако това презапише junction-а (зависи от версията Git).

  ПРЕДИ старт: затвори IDE/терминали/Explorer върху `agrinexus-final-main\fieldlot`.

  Старт от корена на AgriNexus:
    powershell -ExecutionPolicy Bypass -File .\scripts\windows\junction-fieldlot-to-project.ps1

  Персонални пътища:
    .\scripts\windows\junction-fieldlot-to-project.ps1 -AgriRoot "D:\repos\agrinexus-final-main" -FieldlotCanonical "D:\repos\fieldlot"
#>

param(
	[string]$AgriRoot = "",
	[string]$FieldlotCanonical = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$desktop = [Environment]::GetFolderPath("Desktop")
if (-not $desktop) { $desktop = Join-Path $env:USERPROFILE "Desktop" }

if (-not $AgriRoot) {
	$AgriRoot = Join-Path $desktop "project\agrinexus-final-main"
}
if (-not $FieldlotCanonical) {
	$FieldlotCanonical = Join-Path $desktop "project\fieldlot"
}

$linkPath = Join-Path $AgriRoot "fieldlot"

function Test-SameJunction([string]$Path, [string]$ExpectedTarget) {
	if (-not (Test-Path -LiteralPath $Path)) { return $false }
	$item = Get-Item -LiteralPath $Path -Force
	if ($item.LinkType -ne "Junction") { return $false }
	$t = $item.Target
	if ($null -eq $t) { return $false }
	$actual = if ($t -is [string]) { $t } else { $t[0] }
	return ([string]$actual).TrimEnd("\") -ieq $ExpectedTarget.TrimEnd("\")
}

Write-Host "AgriNexus root:     $AgriRoot"
Write-Host "FieldLot junction:  $linkPath"
Write-Host "FieldLot target:    $FieldlotCanonical"
Write-Host ""

if (-not (Test-Path -LiteralPath $AgriRoot)) {
	Write-Error "Липсва AgriNexus root: $AgriRoot"
	exit 2
}
if (-not (Test-Path -LiteralPath $FieldlotCanonical)) {
	Write-Error "Липсва каноничният FieldLot: $FieldlotCanonical"
	exit 2
}
$gitDir = Join-Path $FieldlotCanonical ".git"
if (-not (Test-Path -LiteralPath $gitDir)) {
	Write-Error "В целта няма .git — не изглежда като git репо: $FieldlotCanonical"
	exit 2
}

if (Test-SameJunction -Path $linkPath -ExpectedTarget $FieldlotCanonical) {
	Write-Host "Вече има junction към тази цел. Нищо не се променя."
	exit 0
}

if (Test-Path -LiteralPath $linkPath) {
	$item = Get-Item -LiteralPath $linkPath -Force
	if ($item.LinkType -eq "Junction") {
		Write-Host "Премахвам стара junction..."
		Remove-Item -LiteralPath $linkPath -Force
	}
	else {
		$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
		$backup = Join-Path $AgriRoot "fieldlot-backup-$stamp"
		Write-Host "Преименувам съществуващата папка fieldlot в:"
		Write-Host "  $backup"
		try {
			Rename-Item -LiteralPath $linkPath -NewName (Split-Path $backup -Leaf)
		}
		catch {
			Write-Error @"
Не може да се преименува (вероятно папката е отворена в Cursor/IDE).
Затвори всички прозорци върху fieldlot и пусни скрипта отново.

Оригинална грешка: $($_.Exception.Message)
"@
			exit 1
		}
	}
}

Write-Host "Създавам junction..."
New-Item -ItemType Junction -Path $linkPath -Target $FieldlotCanonical | Out-Null
Write-Host ""
Write-Host "Готово. Папката fieldlot под AgriNexus сочи към същата директория като каноничният clone."
Write-Host "Git за FieldLot: работи от $FieldlotCanonical"
exit 0

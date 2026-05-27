# FieldLot: един clone чрез junction

## Цел

Да няма две копия на кода: `Desktop\project\agrinexus-final-main\fieldlot` да сочи към **`Desktop\project\fieldlot`** (каноничният clone на `fieldlot.git`).

## Стъпки

1. Затвори Cursor/VS Code, терминали и Explorer, отворени върху **`...\agrinexus-final-main\fieldlot`**.
2. От PowerShell, от корена на AgriNexus:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\junction-fieldlot-to-project.ps1
```

По подразбиране се ползват:

- AgriNexus: `%USERPROFILE%\OneDrive\Desktop\project\agrinexus-final-main`
- FieldLot: `%USERPROFILE%\OneDrive\Desktop\project\fieldlot`

Други дискове/папки:

```powershell
.\scripts\windows\junction-fieldlot-to-project.ps1 -AgriRoot "D:\agrinexus-final-main" -FieldlotCanonical "D:\fieldlot"
```

## Git submodule (важно)

В AgriNexus `fieldlot` е записан като **submodule** в `.gitmodules`. След junction съдържанието на `agrinexus-final-main\fieldlot` е **същото** като при `project\fieldlot`, включително **`.git`** на fieldlot репото.

- Commit и push към **fieldlot.git**: от папката **`project\fieldlot`** (или през junction пътя — едно и също).
- В **родителя** AgriNexus `git status` може да покаже променен submodule; това е очаквано, докато pointer-ът в родителя не съвпада с последния commit в fieldlot.
- Избягвай сляпо `git submodule update --force` в родителя, ако Git опита да замести junction с checkout — при съмнение провери с `Get-Item .\fieldlot | Format-List *` (трябва `LinkType : Junction`).

## OneDrive

Junction на папки под OneDrive понякога води до странно синхронизиране. При проблем работи само от **`project\fieldlot`** без junction.

## Премахване на junction

Затвори IDE, после:

```powershell
Remove-Item -LiteralPath "...\agrinexus-final-main\fieldlot" -Force
git submodule update --init fieldlot
```

(възстановява нормалния submodule checkout, ако е конфигуриран.)

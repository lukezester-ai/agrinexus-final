# Работна папка: кирилица `проект` срещу ASCII `project`

## Какъв беше проблемът

На Windows често се появяват **две различни папки**:

| Път | Типично съдържание |
|-----|---------------------|
| `Desktop\project\agrinexus-final-main` | Пълното репо (`apps/`, `package.json`, `.git`, …) |
| `Desktop\проект\agrinexus-final-main` | Понякога само архив, малък `package-lock.json` или старо копие — **без** последния код |

Ако отвориш проекта от **кириличния** път, Cursor и терминалът работят върху „празното“ копие — промените от агента изглежда „липсват“, а билдът е в другата папка.

## Решение A (препоръчано): една директория чрез junction

1. **Затвори** Cursor/VS Code, всички терминали и Explorer прозорци, отворени в `...\проект\agrinexus-final-main`.
2. Отвори PowerShell и изпълни (от корена на репото под **`project\`**):

```powershell
cd $env:USERPROFILE\OneDrive\Desktop\project\agrinexus-final-main
powershell -ExecutionPolicy Bypass -File .\scripts\windows\link-cyrillic-desktop-folder.ps1
```

Скриптът преименува старата папка под `проект\` в `agrinexus-final-main-backup-…` и създава **junction** с име `agrinexus-final-main`, която сочи към `Desktop\project\agrinexus-final-main`. Така и двата пътя виждат **едни и същи файлове**.

Ако видиш грешка „file is being used“, затвори IDE и пусни скрипта отново.

## Решение B: без junction

Отваряй репото **само** от:

`%USERPROFILE%\OneDrive\Desktop\project\agrinexus-final-main`

и не ползвай дублиращата папка под `проект\`, докато не направиш junction.

## Бележка за OneDrive

Junction-ите понякога се държат по-особено със синхронизация. Ако нещо се обърка, ползвай директно ASCII пътя или провери настройките на OneDrive за тази папка.

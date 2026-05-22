import os
import shutil

translations = {
    # Nav
    '>Agents<': '>Агенты<',
    '>Platform<': '>Платформа<',
    '>Market Intelligence<': '>Аналитика Рынка<',
    '>Market<': '>Аналитика<',
    '>Academy<': '>Академия<',
    '>Dashboard<': '>Панель управления<',
    '>Join free<': '>Бесплатно<',
    
    # Language Toggle fixing for RU pages
    '>EN<': '>EN<',
    '>RU<': '>RU<',
    
    # Hero Texts
    'Eighteen specialists. One thinking farm.': 'Восемнадцать специалистов. Одна мыслящая ферма.',
    'An operating system that senses, thinks, acts.': 'Операционная система, которая чувствует, думает и действует.',
    'Three layers, one nervous system.': 'Три уровня, одна нервная система.',
    'Trade your harvest like a hedge fund.': 'Торгуйте урожаем как хедж-фонд.',
    'A library that grows with you.': 'Библиотека, которая растет вместе с вами.',
    'Sensors feed the brain, the brain commands the hands. Every signal traceable, every action reversible.': 'Датчики питают мозг, мозг управляет руками. Каждый сигнал отслеживается, каждое действие обратимо.',
    
    # Platform Architecture
    '>collection<': '>сбор данных<',
    '>reasoning<': '>анализ<',
    '>execution<': '>исполнение<',
    'Satellites': 'Спутники',
    'IoT sensors': 'IoT-датчики',
    'News & markets': 'Новости и рынки',
    'Field reports': 'Полевые отчеты',
    'Data lake': 'Озеро данных',
    'Agent mesh': 'Сеть агентов',
    'Models': 'Модели',
    'Daily Briefing': 'Сводка дня',
    'Auto actions': 'Авто-действия',
    'Mobile & voice': 'Мобильный и голос',
    
    # Academy
    'Learning, written by people who actually farm.': 'Обучение, написанное теми, кто реально занимается фермерством.',
    'Every article peer-reviewed by working agronomists and traders. Always free.': 'Каждая статья проверяется работающими агрономами и трейдерами. Всегда бесплатно.',
    'Open the library': 'Открыть библиотеку',
    'Get the weekly': 'Получать еженедельно',
    'This week\'s reading': 'Чтение на этой неделе',
    'Learning paths': 'Пути обучения',
    'Fresh articles': 'Свежие статьи',
    'Field Notes podcast': 'Подкаст "Полевые заметки"',
    'Farmer\'s table community': 'Сообщество фермеров',
    
    # Agents
    'Crop Lifecycle': 'Жизненный цикл урожая',
    'Monitoring & Detection': 'Мониторинг и Обнаружение',
    'Operations': 'Операции',
    'Business & Compliance': 'Бизнес и Комплаенс',
    'Meta Layer': 'Мета-уровень',
    
    # Market
    'Live ticker': 'Живой тикер',
    'Forecast targets': 'Прогнозы',
    'Break-even analysis': 'Анализ безубыточности',
    'Optimal Selling Window': 'Оптимальное окно продажи'
}

def translate_file(filepath, outpath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    for en, ru in translations.items():
        content = content.replace(en, ru)
        
    # Fix the language toggle specifically for RU pages
    # <a href="index.html" ...>EN</a> | <a href="ru/index.html" ...>RU</a>
    # should become
    # <a href="../index.html" ...>EN</a> | <a href="index.html" ...>RU</a>
    filename = os.path.basename(filepath)
    content = content.replace(f'href="{filename}" style="color: var(--text-main, #111)', f'href="../{filename}" style="color: inherit')
    content = content.replace(f'href="ru/{filename}" style="color: inherit', f'href="{filename}" style="color: var(--text-main, #111)')
    
    # Fix asset paths if any (e.g., CSS/JS links if they were relative, though here CSS is inline)
    
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(content)

def main():
    os.makedirs('ru', exist_ok=True)
    files = ['index.html', 'agents.html', 'platform.html', 'market-intelligence.html', 'academy.html', 'dashboard.html']
    for file in files:
        if os.path.exists(file):
            translate_file(file, os.path.join('ru', file))
            print(f'Translated {file} to ru/{file}')

if __name__ == '__main__':
    main()

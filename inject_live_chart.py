import os

def update_market_page():
    files = ['market-intelligence.html', 'ru/market-intelligence.html']
    
    new_chart_html = """
        <!-- Live Interactive Chart -->
        <div class="term-chart-area" style="position: relative; height: 350px; border: none;">
            <canvas id="marketChart" width="100%" height="100%"></canvas>
            <!-- Loading indicator -->
            <div id="chart-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--gold); font-family: 'JetBrains Mono', monospace;">
                [FETCHING MARKET DATA...]
            </div>
            <!-- Symbol Selector -->
            <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 8px;">
                <button onclick="loadChart('ZW=F')" class="btn btn-outline" style="padding: 4px 8px; font-size: 12px; font-family: 'JetBrains Mono', monospace; border-color: var(--gold); color: var(--gold);">ZW=F (Wheat)</button>
                <button onclick="loadChart('ZC=F')" class="btn btn-outline" style="padding: 4px 8px; font-size: 12px; font-family: 'JetBrains Mono', monospace; border-color: var(--border-light); color: var(--text-muted);" id="btn-corn">ZC=F (Corn)</button>
            </div>
        </div>
    """
    
    chart_scripts = """
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        let marketChart = null;

        async function loadChart(symbol) {
            document.getElementById('chart-loading').style.display = 'block';
            
            // Update buttons styling
            const isWheat = symbol === 'ZW=F';
            event?.target?.parentElement?.children[0].setAttribute('style', isWheat ? 'padding: 4px 8px; font-size: 12px; font-family: monospace; border: 1px solid var(--gold); color: var(--gold); background: rgba(212, 175, 55, 0.1); cursor: pointer;' : 'padding: 4px 8px; font-size: 12px; font-family: monospace; border: 1px solid var(--border-light); color: var(--text-muted); background: transparent; cursor: pointer;');
            event?.target?.parentElement?.children[1].setAttribute('style', !isWheat ? 'padding: 4px 8px; font-size: 12px; font-family: monospace; border: 1px solid var(--gold); color: var(--gold); background: rgba(212, 175, 55, 0.1); cursor: pointer;' : 'padding: 4px 8px; font-size: 12px; font-family: monospace; border: 1px solid var(--border-light); color: var(--text-muted); background: transparent; cursor: pointer;');

            try {
                const res = await fetch('/api/market-history?symbol=' + symbol);
                const result = await res.json();
                
                const labels = result.data.map(d => d.date);
                const dataPoints = result.data.map(d => d.price);

                // Main neon color (gold for wheat, green for corn)
                const neonColor = isWheat ? '#D4AF37' : '#2D5A27';
                
                const ctx = document.getElementById('marketChart').getContext('2d');
                
                // Gradient fill
                const gradient = ctx.createLinearGradient(0, 0, 0, 350);
                gradient.addColorStop(0, isWheat ? 'rgba(212, 175, 55, 0.4)' : 'rgba(45, 90, 39, 0.4)');
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                if (marketChart) {
                    marketChart.destroy();
                }

                marketChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: isWheat ? 'Wheat (EUR/t)' : 'Corn (EUR/t)',
                            data: dataPoints,
                            borderColor: neonColor,
                            backgroundColor: gradient,
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            pointHoverBackgroundColor: '#fff',
                            fill: true,
                            tension: 0.4 // Smooth curve
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            intersect: false,
                            mode: 'index',
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(20, 20, 20, 0.9)',
                                titleColor: '#fff',
                                bodyColor: neonColor,
                                titleFont: { family: 'JetBrains Mono', size: 12 },
                                bodyFont: { family: 'Times New Roman', size: 16 },
                                padding: 12,
                                borderColor: 'rgba(255,255,255,0.1)',
                                borderWidth: 1,
                                displayColors: false,
                                callbacks: {
                                    label: function(context) {
                                        return context.parsed.y.toFixed(2);
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false, color: 'rgba(255,255,255,0.05)' },
                                ticks: {
                                    color: 'rgba(255,255,255,0.4)',
                                    font: { family: 'JetBrains Mono', size: 10 },
                                    maxTicksLimit: 6
                                }
                            },
                            y: {
                                grid: { color: 'rgba(255,255,255,0.05)' },
                                ticks: {
                                    color: 'rgba(255,255,255,0.4)',
                                    font: { family: 'JetBrains Mono', size: 10 },
                                    callback: function(value) {
                                        return value.toFixed(0);
                                    }
                                }
                            }
                        }
                    }
                });

                document.getElementById('chart-loading').style.display = 'none';

                // Update the big terminal numbers
                if (dataPoints.length > 0) {
                    const latest = dataPoints[dataPoints.length - 1];
                    const prev = dataPoints[dataPoints.length - 2] || latest;
                    const diff = latest - prev;
                    
                    document.querySelector('.term-price-main span:first-child').textContent = latest.toFixed(2);
                    const deltaEl = document.querySelector('.term-delta');
                    deltaEl.textContent = (diff >= 0 ? '+' : '') + diff.toFixed(2);
                    deltaEl.style.color = diff >= 0 ? 'var(--green-bright)' : 'var(--terracotta)';
                }

            } catch (err) {
                console.error("Chart error:", err);
                document.getElementById('chart-loading').textContent = '[ERROR FETCHING DATA]';
            }
        }

        // Initial load
        window.addEventListener('DOMContentLoaded', () => {
            loadChart('ZW=F');
        });
    </script>
    """
    
    for filepath in files:
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find the old mock chart
        old_chart_start = '<div class="term-chart-area">'
        old_chart_end = '<div class="today-line"></div>\n        </div>'
        
        # It might be slightly different
        import re
        content = re.sub(r'<div class="term-chart-area">.*?<div class="today-line"></div>\s*</div>', new_chart_html, content, flags=re.DOTALL)

        # Inject script at bottom
        if 'Chart.js' not in content:
            content = content.replace('</body>', chart_scripts + '\n</body>')

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

if __name__ == "__main__":
    update_market_page()

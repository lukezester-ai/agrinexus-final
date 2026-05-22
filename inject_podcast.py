import os
import re

def update_podcast_player():
    files = ['academy.html', 'ru/academy.html']
    
    new_player_html = """
            <div class="pod-right" style="width: 100%;">
                <div class="custom-player" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 24px; width: 100%; max-width: 400px; backdrop-filter: blur(10px);">
                    <audio id="podcast-audio" src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"></audio>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                        <button id="play-pause-btn" style="width: 56px; height: 56px; border-radius: 50%; background: var(--gold); border: none; cursor: pointer; display: flex; justify-content: center; align-items: center; box-shadow: 0 8px 16px rgba(212, 163, 42, 0.3); transition: transform 0.2s;">
                            <svg id="play-icon" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                            <svg id="pause-icon" width="24" height="24" viewBox="0 0 24 24" fill="white" style="display: none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        </button>
                        
                        <div class="sound-waves" style="display: flex; gap: 4px; align-items: center; height: 40px;">
                            <div class="wave-bar" style="width: 4px; height: 10px; background: rgba(255,255,255,0.3); border-radius: 2px; transition: height 0.1s;"></div>
                            <div class="wave-bar" style="width: 4px; height: 20px; background: rgba(255,255,255,0.3); border-radius: 2px; transition: height 0.1s;"></div>
                            <div class="wave-bar" style="width: 4px; height: 40px; background: var(--gold); border-radius: 2px; transition: height 0.1s;"></div>
                            <div class="wave-bar" style="width: 4px; height: 15px; background: rgba(255,255,255,0.3); border-radius: 2px; transition: height 0.1s;"></div>
                            <div class="wave-bar" style="width: 4px; height: 25px; background: rgba(255,255,255,0.3); border-radius: 2px; transition: height 0.1s;"></div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div id="progress-container" style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; cursor: pointer; position: relative;">
                            <div id="progress-bar" style="width: 0%; height: 100%; background: var(--gold); border-radius: 3px; position: absolute; top: 0; left: 0;"></div>
                            <div id="progress-head" style="width: 12px; height: 12px; background: white; border-radius: 50%; position: absolute; top: 50%; left: 0%; transform: translate(-50%, -50%); box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.6);">
                            <span id="time-current">00:00</span>
                            <span id="time-total">06:12</span>
                        </div>
                    </div>
                </div>
            </div>
    """
    
    script_html = """
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const audio = document.getElementById('podcast-audio');
            const playBtn = document.getElementById('play-pause-btn');
            const playIcon = document.getElementById('play-icon');
            const pauseIcon = document.getElementById('pause-icon');
            const progressBar = document.getElementById('progress-bar');
            const progressHead = document.getElementById('progress-head');
            const progressContainer = document.getElementById('progress-container');
            const timeCurrent = document.getElementById('time-current');
            const timeTotal = document.getElementById('time-total');
            const waveBars = document.querySelectorAll('.wave-bar');
            
            let isPlaying = false;
            let animationId = null;

            function formatTime(seconds) {
                if (isNaN(seconds)) return "00:00";
                const m = Math.floor(seconds / 60);
                const s = Math.floor(seconds % 60);
                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }

            audio.addEventListener('loadedmetadata', () => {
                timeTotal.textContent = formatTime(audio.duration);
            });

            function animateWaves() {
                if (!isPlaying) return;
                waveBars.forEach(bar => {
                    if (bar.style.backgroundColor !== 'var(--gold)') {
                        bar.style.height = `${Math.random() * 30 + 10}px`;
                        bar.style.backgroundColor = `rgba(255,255,255,${Math.random() * 0.5 + 0.3})`;
                    }
                });
                animationId = setTimeout(animateWaves, 150);
            }

            playBtn.addEventListener('click', () => {
                if (isPlaying) {
                    audio.pause();
                    playIcon.style.display = 'block';
                    pauseIcon.style.display = 'none';
                    playBtn.style.transform = 'scale(1)';
                    clearTimeout(animationId);
                } else {
                    audio.play();
                    playIcon.style.display = 'none';
                    pauseIcon.style.display = 'block';
                    playBtn.style.transform = 'scale(1.05)';
                    animateWaves();
                }
                isPlaying = !isPlaying;
            });

            audio.addEventListener('timeupdate', () => {
                const percent = (audio.currentTime / audio.duration) * 100;
                progressBar.style.width = `${percent}%`;
                progressHead.style.left = `${percent}%`;
                timeCurrent.textContent = formatTime(audio.currentTime);
            });

            progressContainer.addEventListener('click', (e) => {
                const rect = progressContainer.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                audio.currentTime = pos * audio.duration;
            });
            
            audio.addEventListener('ended', () => {
                isPlaying = false;
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
                clearTimeout(animationId);
                progressBar.style.width = '0%';
                progressHead.style.left = '0%';
                audio.currentTime = 0;
            });
        });
    </script>
    """

    for filepath in files:
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Regex to find the .pod-right section and replace it
        pattern = r'<div class="pod-right">.*?</div>\s*</div>\s*</div>\s*</div>\s*(<!-- COMMUNITY TABLE -->|</main>|<script>|</body>)'
        # Wait, the pod-right contains waveform, let's just replace from <div class="pod-right"> to the end of pod-right.
        # It's safer to use string replacement since we know the exact HTML structure from the view.
        
        old_pod_right_start = '<div class="pod-right">'
        
        # We need to extract the exact pod-right block to replace it.
        start_idx = content.find(old_pod_right_start)
        if start_idx != -1:
            end_idx = content.find('<!-- COMMUNITY TABLE -->', start_idx)
            if end_idx != -1:
                # But wait, there are closing divs before COMMUNITY TABLE
                # Let's use regex
                sub_content = content[start_idx:end_idx]
                # It looks like:
                # <div class="pod-right">
                #    <div class="waveform">...</div>
                # </div>
                # </div>
                # </div>
                # </div>
                
                # I'll just replace the inner contents of pod-card
                pod_card_start = '<div class="podcast-card">'
                pod_card_idx = content.find(pod_card_start)
                
                # We can just replace the whole waveform div
                waveform_block = re.search(r'<div class="pod-right">.*?<div class="waveform">.*?</div>\s*</div>', content, re.DOTALL)
                
                if waveform_block:
                    content = content.replace(waveform_block.group(0), new_player_html)
                    
                    if '<audio id="podcast-audio"' not in content:
                        print("Failed to inject HTML")
                    else:
                        if 'podcast-audio' not in content[content.rfind('<script'):]:
                            content = content.replace('</body>', script_html + '\n</body>')
                        
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"Updated {filepath}")
                else:
                    print(f"Could not find waveform block in {filepath}")

if __name__ == "__main__":
    update_podcast_player()

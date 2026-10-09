# User-supplied loading loop

Source: Animate_Roman_game_loading_illus…_20261009081254.mp4, supplied by the user on 9 October 2026. Original in Downloads is preserved. Four seconds, 1920×1080, H.264 at 24 fps, with AAC audio.

Runtime loop-v1.mp4: 1280×720, H.264/yuv420p, CRF 24, faststart; audio omitted for a silent background. No scene timing or content edits. Native muted inline autoplay and looping; the original painted image stays underneath until playback begins and on errors. Reduced-motion users receive the static background without downloading the video element. Arena loading never waits for video playback.

Encoding: ffmpeg -i INPUT -an -vf scale=1280:720 -c:v libx264 -preset medium -crf 24 -pix_fmt yuv420p -movflags +faststart loop-v1.mp4

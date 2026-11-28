set -e
for a in voila gotopic; do
  node render.cjs $a 4
  ffmpeg -hide_banner -v error -y -framerate 240 -i frames-$a/%05d.jpg -i score.wav -filter_complex "[0:v]tmix=frames=4,select='eq(mod(n\,4)\,3)',setpts=N/(60*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]" -map "[v]" -map 1:a -r 60 -c:v libx264 -preset slow -crf 17 -profile:v high -g 120 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 256k -movflags +faststart -t 27 $a-launch.mp4
  echo "DONE $a $(du -h $a-launch.mp4 | cut -f1)"
done

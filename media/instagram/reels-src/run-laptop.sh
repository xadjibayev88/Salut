set -e
for a in voila gotopic; do
  N=5400 node render.cjs laptop $a 4
  ffmpeg -hide_banner -v error -y -framerate 180 -i frames-laptop-$a/%05d.jpg -i $a-laptop.wav -filter_complex "[0:v]tmix=frames=3,select='eq(mod(n\,3)\,2)',setpts=N/(60*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]" -map "[v]" -map 1:a -r 60 -c:v libx264 -preset slow -crf 18 -profile:v high -g 120 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 256k -movflags +faststart -t 30 $a-laptop.mp4
  rm -rf frames-laptop-$a; echo "DONE $a $(du -h $a-laptop.mp4 | cut -f1)"
done

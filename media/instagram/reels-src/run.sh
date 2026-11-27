set -e
for v in ekran kinetik; do for a in voila gotopic; do
  node render.cjs $v $a 4
  ffmpeg -hide_banner -v error -y -framerate 180 -i frames-$v-$a/%05d.jpg -i $a-$v.wav -filter_complex "[0:v]tmix=frames=3,select='eq(mod(n\,3)\,2)',setpts=N/(60*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]" -map "[v]" -map 1:a -r 60 -c:v libx264 -preset slow -crf 17 -profile:v high -g 120 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 256k -movflags +faststart -t 25 $a-$v.mp4
  rm -rf frames-$v-$a; echo "DONE $a-$v $(du -h $a-$v.mp4 | cut -f1)"
done; done

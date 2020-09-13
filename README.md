# 404 Rally

Build for game jam [js13k 2020](https://js13kgames.com/)

The game core is a minimal WebGl 3D renderer and a physics 2D library. I built the 3D renderer for this game and modified an 2D physics library I built earlier to suit the game idea.

## Credits

Webgl resources:

* [Best place to learn Webgl from scratch](https://xem.github.io/articles/webgl-guide.html#3h)
* [3D object hierarchy](https://webglfundamentals.org/webgl/lessons/webgl-scene-graph.html)

Build process is based on: https://github.com/shreyasminocha/js13k-boilerplate . In addition all js code is merged into index.html file within a ```<script>``` tag and the resulting zip file of the build process contains only that html file.

## Todo:

* Write about WebRTC + WebSockets (There was no one great tutorial about the topic. So, I scratched together my implementation from various places.)
    * One can get started by examples about p2p on one browser window, and when connecting to different windows there are weird issues. Like: candidates can be added after the initial handshakes have happened. But the local implementation does not make this very visible. And finding it out from documentation takes much more reading than a full WebRTC p2p example.
    * I still recommend starting from single browser window example cause multi window one takes some more effort

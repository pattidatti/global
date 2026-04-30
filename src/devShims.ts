// Pixi 8.18 har en bug i `logPrettyShaderError` der `gl.getShaderSource()`
// returnerer null (skjer på software-rendering / SwiftShader / enkelte drivers)
// og påfølgende `.split("\n")` krasjer hele rendering-loopen.
//
// Vi shimmer getShaderSource så den aldri returnerer null. Dette lar Pixis
// feil-logger fullføre og logge den ekte GL-shader-feilen til konsollen
// istedenfor å krasje på sin egen logging.

function patchGetShaderSource(proto: WebGLRenderingContext | WebGL2RenderingContext): void {
  const desc = Object.getOwnPropertyDescriptor(proto, 'getShaderSource');
  if (!desc || typeof desc.value !== 'function') return;
  const original = desc.value as (shader: WebGLShader) => string | null;
  Object.defineProperty(proto, 'getShaderSource', {
    value: function (this: WebGLRenderingContext, shader: WebGLShader): string {
      const src = original.call(this, shader);
      return src ?? '// <shader source unavailable from GL driver>';
    },
    writable: true,
    configurable: true,
  });
}

if (typeof WebGLRenderingContext !== 'undefined') {
  patchGetShaderSource(WebGLRenderingContext.prototype);
}
if (typeof WebGL2RenderingContext !== 'undefined') {
  patchGetShaderSource(WebGL2RenderingContext.prototype);
}

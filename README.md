# zatstv_3d

Diseñador web de llaveros para impresión 3D. Se elige una forma, se escribe un nombre y se descarga
el STL listo para Bambu Studio (pensado para la Bambu Lab A1, cama de 256 × 256 mm).

## Uso

```bash
npm install
npm run dev
```

Abre la URL que muestra la terminal (normalmente http://localhost:5173).

## Qué hace

- **Formas:** contorno del texto, rectángulo redondeado, círculo/óvalo, hexágono y corazón.
- **Texto:** varias líneas, 5 fuentes, en relieve, grabado o a ras (para dos colores).
- **Argolla:** agujero a la izquierda, derecha o arriba, con diámetro y pared ajustables.
- **Exportar:** un STL de una pieza, o `base.stl` + `texto.stl` para imprimir en dos colores con el AMS lite.
- Avisa si el texto se sale de la figura, si quedan piezas sueltas o si no cabe en la cama.
- Recuerda el último diseño en el navegador.

## Tecnología

- React + TypeScript + Vite
- Three.js / React Three Fiber para la vista previa
- [manifold-3d](https://github.com/elalish/manifold) para las operaciones booleanas (modelos sólidos, sin errores de malla)
- opentype.js para convertir fuentes en contornos

Todo el código de geometría está en `src/lib/keychain.ts`.

## Próximos pasos

- Foto de referencia → silueta (trazado de imagen) o relieve
- Guardar y cargar plantillas
- Más objetos además de llaveros

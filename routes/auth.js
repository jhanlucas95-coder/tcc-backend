const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// 1. RUTA DE REGISTRO
router.post('/registro', async (req, res) => {
    try {
        const { nombre, correo, contrasena, rol } = req.body;

        // Verificar si el usuario ya existe
        let usuarioExiste = await Usuario.findOne({ correo });
        if (usuarioExiste) {
            return res.status(400).json({ mensaje: 'El correo electrónico ya está registrado' });
        }

        // Crear la instancia del nuevo usuario
        const nuevoUsuario = new Usuario({ nombre, correo, contrasena, rol });

        // Encriptar la contraseña (Hushing)
        const salt = await bcrypt.genSalt(10);
        nuevoUsuario.contrasena = await bcrypt.hash(contrasena, salt);

        // Guardar permanentemente en la base de datos
        await nuevoUsuario.save();

        res.status(201).json({ mensaje: 'Usuario registrado con éxito' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el servidor al registrar', error: error.message });
    }
});

// 2. RUTA DE INICIO DE SESIÓN (LOGIN)
router.post('/login', async (req, res) => {
    try {
        const { correo, contrasena } = req.body;

        // Buscar que el usuario exista
        const usuarioEncontrado = await Usuario.findOne({ correo });
        if (!usuarioEncontrado) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas (Correo no encontrado)' });
        }

        // Comparar las contraseñas encriptadas
        const esCorrecta = await bcrypt.compare(contrasena, usuarioEncontrado.contrasena);
        if (!esCorrecta) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas (Contraseña incorrecta)' });
        }

        // Generar el Token de seguridad (JWT) incluyendo su Rol
        const token = jwt.sign(
            { id: usuarioEncontrado._id, rol: usuarioEncontrado.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' } // El token expira en 8 horas
        );

        // Retornar los datos de éxito al cliente
        res.json({
            token,
            usuario: {
                id: usuarioEncontrado._id,
                nombre: usuarioEncontrado.nombre,
                rol: usuarioEncontrado.rol
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el servidor al iniciar sesión', error: error.message });
    }
});

module.exports = router;
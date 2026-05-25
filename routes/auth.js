const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

router.post('/registro', async (req, res) => {
    try {
        const { nombre, correo, contrasena, rol } = req.body;


        let usuarioExiste = await Usuario.findOne({ correo });
        if (usuarioExiste) {
            return res.status(400).json({ mensaje: 'El correo electrónico ya está registrado' });
        }


        const nuevoUsuario = new Usuario({ nombre, correo, contrasena, rol });


        const salt = await bcrypt.genSalt(10);
        nuevoUsuario.contrasena = await bcrypt.hash(contrasena, salt);


        await nuevoUsuario.save();

        res.status(201).json({ mensaje: 'Usuario registrado con éxito' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el servidor al registrar', error: error.message });
    }
});


router.post('/login', async (req, res) => {
    try {
        const { correo, contrasena } = req.body;


        const usuarioEncontrado = await Usuario.findOne({ correo });
        if (!usuarioEncontrado) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas (Correo no encontrado)' });
        }


        const esCorrecta = await bcrypt.compare(contrasena, usuarioEncontrado.contrasena);
        if (!esCorrecta) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas (Contraseña incorrecta)' });
        }


        const token = jwt.sign(
            { id: usuarioEncontrado._id, rol: usuarioEncontrado.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' } // El token expira en 8 horas
        );


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
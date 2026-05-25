const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio']
    },
    correo: {
        type: String,
        required: [true, 'El correo es obligatorio'],
        unique: true,
        lowercase: true
    },
    contrasena: {
        type: String,
        required: [true, 'La contraseña es obligatoria']
    },
    rol: {
        type: String,
        required: true,
        enum: ['Coordinador', 'Investigador Principal', 'Coinvestigador'],
        default: 'Coinvestigador'
    }
}, { timestamps: true });

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);
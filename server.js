const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Asegurar la existencia de la carpeta para almacenar archivos físicos
const dirUploads = './uploads';
if (!fs.existsSync(dirUploads)) {
    fs.mkdirSync(dirUploads);
}

// Conectar a MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('  🔌  Conectado exitosamente a MongoDB Atlas (Base de Datos Real)');
        inicializarProyectoBase();
    })
    .catch(err => console.error('  ❌  Error crítico al conectar a MongoDB:', err));

// --- DEFINICIÓN DE MODELOS DE MONGOOSE ---
const UsuarioSchema = new mongoose.Schema({
    nombre: String,
    correo: { type: String, unique: true },
    contrasena: String,
    rol: String
});
const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', UsuarioSchema);

const ProyectoSchema = new mongoose.Schema({
    titulo: { type: String, default: "Sistema Colaborativo de Gestión de Inventarios - Pro Line Racing" },
    progreso: { type: Number, default: 0 },
    tareas: [{
        nombre: String,
        responsable: String,
        estado: { type: String, default: 'pendiente' }
    }]
});
const Proyecto = mongoose.models.Proyecto || mongoose.model('Proyecto', ProyectoSchema);

const MensajeSchema = new mongoose.Schema({
    remitente: String,
    texto: String,
    fecha: { type: String, default: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    privado: { type: Boolean, default: false },
    destinatario: { type: String, default: 'Todos' }
});
const Mensaje = mongoose.models.Mensaje || mongoose.model('Mensaje', MensajeSchema);

const DocumentoSchema = new mongoose.Schema({
    nombreOriginal: String,
    nombreServidor: String,
    tipo: String,
    subidoPor: String,
    fecha: { type: Date, default: Date.now }
});
const Documento = mongoose.models.Documento || mongoose.model('Documento', DocumentoSchema);

// Inicialización de la App
const app = express();
const server = http.createServer(app);

// ==========================================
// CONFIGURACIÓN PARA EL DESPLIEGUE (CORS)
// ==========================================
// URL exacta de tu Vercel (sin el slash / al final para evitar problemas)
const VERCEL_URL = 'https://tcc-frontend-joyivoc1t-jhan-s-projects1.vercel.app';

const corsOptions = {
    origin: [
        /localhost:\d+$/, // Permite pruebas locales
        VERCEL_URL // Permite tu frontend en producción
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
};

// Aplicamos la misma regla de CORS de forma unificada
app.use(cors(corsOptions));
app.use(express.json());

// ==========================================
// MIDDLEWARES DE SEGURIDAD (JWT Y ROLES)
// ==========================================
const verificarToken = (req, res, next) => {
    const tokenHeader = req.header('Authorization');
    if (!tokenHeader) {
        return res.status(401).json({ mensaje: 'Acceso denegado. No se proporcionó un token de seguridad.' });
    }
    const token = tokenHeader.startsWith('Bearer ') ? tokenHeader.split(' ')[1] : tokenHeader;
    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = verificado;
        next();
    } catch (error) {
        return res.status(403).json({ mensaje: 'Token no válido o expirado.' });
    }
};

const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({
                mensaje: `Acceso denegado. Esta acción requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}`
            });
        }
        next();
    };
};

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ==========================================
// CONFIGURACIÓN DE SOCKET.IO
// ==========================================
// Usamos exactamente las mismas opciones de CORS que definimos arriba
const io = new Server(server, { cors: corsOptions });

async function inicializarProyectoBase() {
    const totalProyectos = await Proyecto.countDocuments();
    if (totalProyectos === 0) {
        const nuevoProyecto = new Proyecto({
            titulo: "Optimizar el control de repuestos Racing en Montería Córdoba",
            progreso: 0,
            tareas: [{ nombre: "Diseñar base de datos relacional", responsable: "Jhan", estado: "pendiente" }]
        });
        await nuevoProyecto.save();
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

// --- ENDPOINTS DE PROYECTO Y TAREAS ---
app.get('/api/proyecto', verificarToken, async (req, res) => {
    try {
        let proyecto = await Proyecto.findOne();
        if (!proyecto) {
            proyecto = new Proyecto();
            await proyecto.save();
        }
        res.json(proyecto);
    } catch (err) {
        res.status(500).json({ error: "Error consultando el proyecto" });
    }
});

app.put('/api/proyecto/objetivo', verificarToken, verificarRol(['Coordinador', 'Investigador Principal']), async (req, res) => {
    const { titulo } = req.body;
    if (!titulo) return res.status(400).json({ mensaje: "El título no puede estar vacío" });
    try {
        let proyecto = await Proyecto.findOne();
        proyecto.titulo = titulo;
        await proyecto.save();
        io.emit('proyecto_actualizado', proyecto);
        res.json({ mensaje: "Objetivo actualizado con éxito", titulo });
    } catch (err) {
        res.status(500).json({ error: "Error al actualizar objetivo" });
    }
});

app.post('/api/proyecto/tarea', verificarToken, verificarRol(['Coordinador', 'Investigador Principal']), async (req, res) => {
    const { nombre, responsable } = req.body;
    if (!nombre || !responsable) return res.status(400).json({ mensaje: "Faltan campos obligatorios" });
    try {
        let proyecto = await Proyecto.findOne();
        if (!proyecto) proyecto = new Proyecto();
        proyecto.tareas.push({ nombre, responsable, estado: 'pendiente' });
        const completadas = proyecto.tareas.filter(t => t.estado === 'completada').length;
        proyecto.progreso = proyecto.tareas.length > 0 ? Math.round((completadas / proyecto.tareas.length) * 100) : 0;
        await proyecto.save();
        io.emit('proyecto_actualizado', proyecto);
        res.status(201).json(proyecto);
    } catch (err) {
        res.status(500).json({ error: "Error al guardar la tarea" });
    }
});

app.put('/api/proyecto/tarea/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    try {
        let proyecto = await Proyecto.findOne();
        const tarea = proyecto.tareas.id(id);
        if (tarea) {
            tarea.estado = estado;
            const completadas = proyecto.tareas.filter(t => t.estado === 'completada').length;
            proyecto.progreso = Math.round((completadas / proyecto.tareas.length) * 100);
            await proyecto.save();
            io.emit('proyecto_actualizado', proyecto);
            res.json(proyecto);
        } else {
            res.status(404).json({ mensaje: "Tarea no encontrada" });
        }
    } catch (err) {
        res.status(500).json({ error: "Error al actualizar la tarea" });
    }
});

app.delete('/api/proyecto/tarea/:id', verificarToken, verificarRol(['Coordinador', 'Investigador Principal']), async (req, res) => {
    const { id } = req.params;
    try {
        let proyecto = await Proyecto.findOne();
        proyecto.tareas.pull({ _id: id });
        const completadas = proyecto.tareas.filter(t => t.estado === 'completada').length;
        proyecto.progreso = proyecto.tareas.length > 0 ? Math.round((completadas / proyecto.tareas.length) * 100) : 0;
        await proyecto.save();
        io.emit('proyecto_actualizado', proyecto);
        res.json(proyecto);
    } catch (err) {
        res.status(500).json({ error: "Error al eliminar la tarea" });
    }
});

// --- ENDPOINTS DE SOPORTE DOCUMENTAL ---
app.post('/api/documentos/subir', verificarToken, upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ mensaje: "No se seleccionó ningún archivo" });
        const { tipo, subidoPor } = req.body;
        const nuevoDoc = new Documento({
            nombreOriginal: req.file.originalname,
            nombreServidor: req.file.filename,
            tipo: tipo || "Reporte Parcial",
            subidoPor: subidoPor || "Investigador"
        });
        await nuevoDoc.save();
        const todosLosDocs = await Documento.find().sort({ fecha: -1 });
        io.emit('documentos_actualizados', todosLosDocs);
        res.status(201).json(nuevoDoc);
    } catch (err) {
        res.status(500).json({ error: "Error en la subida física del archivo" });
    }
});

app.get('/api/documentos', verificarToken, async (req, res) => {
    try {
        const docs = await Documento.find().sort({ fecha: -1 });
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: "Error listando documentos" });
    }
});

// NUEVO ENDPOINT: ELIMINAR DOCUMENTOS (Físico y BD)
app.delete('/api/documentos/:id', verificarToken, verificarRol(['Coordinador', 'Investigador Principal']), async (req, res) => {
    try {
        const docId = req.params.id;
        const documento = await Documento.findById(docId);
        if (!documento) {
            return res.status(404).json({ mensaje: "Documento no encontrado" });
        }
        // Eliminar el archivo físico
        const rutaArchivo = path.join(__dirname, 'uploads', documento.nombreServidor);
        if (fs.existsSync(rutaArchivo)) {
            fs.unlinkSync(rutaArchivo);
        }
        // Eliminar de la base de datos
        await Documento.findByIdAndDelete(docId);
        // Notificar por websockets para que se borre de todas las pantallas
        const todosLosDocs = await Documento.find().sort({ fecha: -1 });
        io.emit('documentos_actualizados', todosLosDocs);
        res.json({ mensaje: "Documento eliminado con éxito" });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar el documento" });
    }
});

// --- ENDPOINTS PARA CHAT PRIVADO Y USUARIOS ---
app.get('/api/mensajes', verificarToken, async (req, res) => {
    try {
        const mensajes = await Mensaje.find().sort({ _id: 1 });
        res.json(mensajes);
    } catch (err) {
        res.status(500).json({ error: "Error cargando historial de chat" });
    }
});

app.get('/api/usuarios', verificarToken, async (req, res) => {
    try {
        const usuarios = await Usuario.find({}, 'nombre correo rol');
        res.json(usuarios);
    } catch (err) {
        res.status(500).json({ error: "Error listando usuarios" });
    }
});

// Lógica de Sockets
io.on('connection', (socket) => {
    socket.on('enviar_mensaje', async (data) => {
        try {
            const nuevoMsg = new Mensaje({
                remitente: data.remitente,
                texto: data.texto,
                privado: data.privado || false,
                destinatario: data.destinatario || 'Todos'
            });
            await nuevoMsg.save();
            io.emit('recibir_mensaje', nuevoMsg);
        } catch (err) {
            console.error("Error guardando mensaje de chat:", err);
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`  🚀  Servidor POO corriendo perfectamente en el puerto ${PORT}`);
});
class Tarea {
    constructor(id, titulo, responsable, estado = 'pendiente') {
        this.id = id;
        this.titulo = titulo;
        this.responsable = responsable;
        this.estado = estado;
    }

    actualizarEstado(nuevoEstado) {
        this.estado = nuevoEstado;
    }
}

module.exports = Tarea;
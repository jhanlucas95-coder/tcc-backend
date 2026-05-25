class Proyecto {
    constructor(id, titulo, objetivo, presupuesto) {
        this.id = id;
        this.titulo = titulo;
        this.objetivo = objetivo;
        this.presupuesto = presupuesto;
        this.tareas = [];
        this.estado = 'en_planeacion';
    }

    agregarTarea(tarea) {
        this.tareas.push(tarea);
    }

    calcularProgreso() {
        if (this.tareas.length === 0) return 0;
        const tareasCompletadas = this.tareas.filter(t => t.estado === 'completada').length;
        return Math.round((tareasCompletadas / this.tareas.length) * 100);
    }
}

module.exports = Proyecto;
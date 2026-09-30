require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./database/pool');
const authRoutes = require('./routes/auth/auth.routes');
const disciplinasRoutes = require('./routes/admin/disciplinas.routes');
const cursosRoutes = require('./routes/admin/cursos.routes');
const nivelesRoutes = require('./routes/admin/niveles.routes');
const profesoresRoutes = require('./routes/admin/profesores.routes');
const periodosRoutes = require('./routes/admin/periodos.routes');
const gruposRoutes = require('./routes/admin/grupos.routes');
const horariosRoutes = require('./routes/admin/horarios.routes');
const alumnosRoutes = require('./routes/admin/alumnos.routes');
const matriculasRoutes = require('./routes/admin/matriculas.routes');
const inscripcionesRoutes = require('./routes/admin/inscripciones.routes');
const asistenciasRoutes = require('./routes/admin/asistencias.routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', async (req, res) => {
  const { rows } = await pool.query('SELECT NOW() AS db_time');
  res.json({ status: 'ok', dbTime: rows[0].db_time });
});

app.use('/auth', authRoutes);
app.use('/admin/disciplinas', disciplinasRoutes);
app.use('/admin/cursos', cursosRoutes);
app.use('/admin/niveles', nivelesRoutes);
app.use('/admin/profesores', profesoresRoutes);
app.use('/admin/periodos', periodosRoutes);
app.use('/admin/grupos', gruposRoutes);
app.use('/admin/grupos/:grupoId/horarios', horariosRoutes.porGrupo);
app.use('/admin/horarios', horariosRoutes.porId);
app.use('/admin/alumnos', alumnosRoutes);
app.use('/admin/matriculas', matriculasRoutes);
app.use('/admin/inscripciones', inscripcionesRoutes);
app.use('/admin/inscripciones/:inscripcionId/asistencias', asistenciasRoutes.porInscripcion);
app.use('/admin/asistencias', asistenciasRoutes.porId);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`GestionTec Academias backend escuchando en http://localhost:${PORT}`);
});

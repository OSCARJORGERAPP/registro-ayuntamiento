const { ObjectId } = require('mongodb');

// Número de registro de entrada: AAAA/NNNNN, secuencial por año.
async function nextNumeroRegistro(db) {
  const year = new Date().getFullYear();
  const count = await db.collection('presentaciones')
    .countDocuments({ numeroRegistro: { $regex: `^${year}/` } });
  return `${year}/${String(count + 1).padStart(5, '0')}`;
}

async function crearPresentacion(db, datos) {
  const { contribuyenteId, areaId, interesado, representante, expone, solicita, adjuntos } = datos;
  const doc = {
    contribuyenteId: new ObjectId(contribuyenteId),
    areaId: areaId ? new ObjectId(areaId) : null,
    tipo: 'instancia_general',
    interesado,                 // { nombre, direccionFiscal }
    representante: representante || null,
    expone,
    solicita,
    adjuntos: adjuntos || [],   // [{ nombre, ruta, mime, tamano }]
    estado: 'registrada',
    numeroRegistro: await nextNumeroRegistro(db),
    fechaEntrada: new Date(),
  };
  const res = await db.collection('presentaciones').insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

function listarPorContribuyente(db, contribuyenteId) {
  return db.collection('presentaciones')
    .find({ contribuyenteId: new ObjectId(contribuyenteId) })
    .sort({ fechaEntrada: -1 }).toArray();
}

function listarPorArea(db, areaIds) {
  const ids = (areaIds || []).map((id) => new ObjectId(id));
  return db.collection('presentaciones')
    .find({ areaId: { $in: ids } })
    .sort({ fechaEntrada: -1 }).toArray();
}

function obtener(db, id) {
  return db.collection('presentaciones').findOne({ _id: new ObjectId(id) });
}

module.exports = { crearPresentacion, listarPorContribuyente, listarPorArea, obtener, nextNumeroRegistro };

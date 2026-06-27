const { ObjectId } = require('mongodb');

// Código de expediente: EXP-AAAA-NNNN, secuencial por año.
async function nextCodigo(db) {
  const year = new Date().getFullYear();
  const count = await db.collection('expedientes')
    .countDocuments({ codigo: { $regex: `^EXP-${year}-` } });
  return `EXP-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function crearExpediente(db, datos) {
  const { tipo, presentacionId, contribuyenteId, areaId } = datos;
  const doc = {
    codigo: await nextCodigo(db),
    tipo,
    fechaCreacion: new Date(),
    contribuyenteId: new ObjectId(contribuyenteId),
    presentacionId: new ObjectId(presentacionId),
    areaId: areaId ? new ObjectId(areaId) : null,
  };
  const res = await db.collection('expedientes').insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

function obtener(db, id) {
  return db.collection('expedientes').findOne({ _id: new ObjectId(id) });
}

function porPresentacion(db, presentacionId) {
  return db.collection('expedientes').findOne({ presentacionId: new ObjectId(presentacionId) });
}

function listarPorArea(db, areaIds) {
  const ids = (areaIds || []).map((id) => new ObjectId(id));
  return db.collection('expedientes')
    .find({ areaId: { $in: ids } })
    .sort({ fechaCreacion: -1 }).toArray();
}

module.exports = { crearExpediente, obtener, porPresentacion, listarPorArea, nextCodigo };

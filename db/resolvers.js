import { GraphQLUpload } from 'graphql-upload';
import oracledb from 'oracledb';
import bcryptjs from 'bcryptjs';
import jwt from "jsonwebtoken";
import path, { parse } from 'path';
import { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import dotenv from 'dotenv';
dotenv.config({ path: 'variables.env' });

const crearToken = (usuario, secreta, expiresIn) => {

  const { id, email } = usuario;
  return jwt.sign({ id, email }, secreta, { expiresIn });
}

export const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    obtenerPrograma: async () => {
      try {
        let pool = oracledb.getPool();
        let conn = await pool.getConnection();

        let sql = 'SELECT N_PERIODO,DESC_PERIODO FROM APP_CAT_PERIODOS';
        let sql1 = 'SELECT CVE_PROGRAMA, DESC_PROGRAMA FROM APP_CAT_PROGRAMAS';
        let sql2 = 'SELECT CVE_PERIODICIDAD,DESC_PERIODICIDAD FROM APP_CAT_PERIODICIDAD';
        let sql3 = 'SELECT MUNICIPIO_ID, MUNICIPIO_DESC FROM APP_CAT_MUNICIPIOS_SEDESEM';
        let sql4 = 'SELECT CVE_BENEFICIO,DESC_BENEFICIO FROM APP_CAT_BENEFICIOS';

        let result = await conn.execute(sql);
        let result1 = await conn.execute(sql1);
        let result2 = await conn.execute(sql2);
        let result3 = await conn.execute(sql3);
        let result4 = await conn.execute(sql4);
        await conn.close();

        let periodo = [];
        let programa = [];
        let periodicidad = [];
        let municipio = [];
        let beneficio = [];
        
        for (let i = 0; i < result.rows.length; i++) {
          periodo.push({ ide: result.rows[i][0], val: result.rows[i][1] });
        }
        for (let i = 0; i < result1.rows.length; i++) {
          programa.push({ ide: result1.rows[i][0], val: result1.rows[i][1] });
        }
        for (let i = 0; i < result2.rows.length; i++) {
          periodicidad.push({ ide: result2.rows[i][0], val: result2.rows[i][1] });
        }
        for (let i = 0; i < result3.rows.length; i++) {
          municipio.push({ ide: result3.rows[i][0], val: result3.rows[i][1] });
        }
        for (let i = 0; i < result4.rows.length; i++) {
          beneficio.push({ ide: result4.rows[i][0], val: result4.rows[i][1] });
        }

        return { beneficio, municipio, periodo, periodicidad, programa }
      
      } catch (error) {
        throw new Error(error);
      } },
    obtenerCURP: async (_, { curpc }) => {
      try {
        let pool = oracledb.getPool();
        let conn = await pool.getConnection();
        let binds = { curpc };
        let sql = 'SELECT N_PERIODO, CVE_PROGRAMA, CVE_MUNICIPIO, CVE_BENEFICIO, CANTIDAD, CVE_PERIODICIDAD FROM FURWEB_METADATO_SR2021 WHERE CURP = :curpc';
        let result = await conn.execute(sql, binds);
        await conn.close();
        const vals = result.rows.flat(1);
        const [a,b,c,d,e,f] = vals;
        const curp = {cantidad:e, cve_beneficio:d, cve_municipio:c, cve_periodicidad:f, n_periodo:a, cve_programa:b}
        return curp;
      } catch (error) {
        console.log(error);
      }
    },
  },
  Mutation: {
    multipleUpload: async (_, { foto }) => {
      let fileUrl = [];
      for (let i = 0; i < foto.length; i++) {
        const { createReadStream, filename, mimetype } = await foto[i];
        const stream = createReadStream();
        let { name } = parse(filename);
        name = name.replace(/([^a-z0-9 ]+)/gi, '-').replace(' ', '_');
        let ext = mimetype.substring(mimetype.indexOf('/') + 1);
        let pathName = path.join(__dirname, `../imagenes/${name}.${ext}`);
        pathName = pathName.replace(' ', '_');
        const out = createWriteStream(pathName);
        await stream.pipe(out);
        pathName = `${'http://localhost:4000/graphql'}${pathName.split('imagenes')[1]}`;
        fileUrl.push({ pathName });
      }
      return "Imagenes subidas de manera correcta";
    },
    crearUsuario: async (_, { input }) => {
      const { email, password } = input;

      try {
        let pool = oracledb.getPool();
        let conn = await pool.getConnection();
        let binds = { email };
        let sql = 'SELECT PASSWORD_1 FROM FURWEB_CTRL_ACCESO_SR2021 WHERE NOMBRE_USUARIO = :email';
        let auth = await conn.execute(sql, binds);

        if (auth.rows.length === 0) {
          return new Error('El  usuario no esta registrado');
        }

        if (auth.rows[0][0] !== password) {
          return new Error('La contraseña es incorrecta');
        }

        //Hashear password
        const salt = await bcryptjs.genSalt(10);
        input.password = await bcryptjs.hash(password, salt);
        let passhash = input.password;
        binds = { email, passhash };
        sql = 'UPDATE FURWEB_CTRL_ACCESO_SR2021 SET PASSWORD_1 = :passhash where NOMBRE_USUARIO = :email';
        await conn.execute(sql, binds, { autoCommit: true });

        await conn.close();
      } catch (error) {
        throw new Error(error);
      }
      return "Usuario Creado Correctamente";

    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      try {
        let pool = oracledb.getPool();
        let conn = await pool.getConnection();
        let binds = { email };
        let sql = 'SELECT FOLIO,NOMBRE_USUARIO, PASSWORD_1 FROM FURWEB_CTRL_ACCESO_SR2021 WHERE NOMBRE_USUARIO = :email';
        let result = await conn.execute(sql, binds);
        
        if (result.rows.length === 0) {
          return new Error('Los datos son incorrectos');
        }
        await conn.close();

        // Si el password es correcto
        const passwordCorrecto = await bcryptjs.compare(password, result.rows[0][2]);
        if (!passwordCorrecto) {
          return new Error('Password Incorrecto');
        }

        const id = result.rows[0][0];

        let usuario = { id, email };
        return {
          token: crearToken(usuario, process.env.SECRETA, '6hr')
        }
      } catch (error) {
        throw new Error(error);
      }
      // Dar acceso a la app
    },
    nuevoBeneficiario: async (_, { input }) => {
      let { period, program, curpData, muni, latitud, longitud, benef, cantidad, periodici,
        tarjeta, fotox } = input;
      let [CURP, , AP, AM, nombres, , fec_nac, , cve_lugar_nac] = curpData;
      cantidad = parseInt(cantidad);
      tarjeta = parseInt(tarjeta);
      cve_lugar_nac = parseInt(cve_lugar_nac);

      try {
        let pool = oracledb.getPool();
        let conn = await pool.getConnection();
        let bind0 = [CURP];
        let sql0 = 'SELECT N_PERIODO FROM FURWEB_METADATO_SR2021 WHERE CURP = :CURP';
        let result0 = await conn.execute(sql0, bind0);
        let nom_comp = nombres + ' ' + AP + ' ' + AM;
        const [foto1, foto2] = fotox;

        let sql = '';
        if (result0.rows.length === 0) {
          let bindn = [{ val: period }, { val: program }, { val: AP }, { val: AM }, { val: nombres }, { val: nom_comp }, { val: fec_nac }, { val: CURP }, { val: cve_lugar_nac }, { val: muni }, { val: cve_lugar_nac }, { val: latitud }, { val: longitud }, { val: benef }, { val: cantidad }, { val: periodici }, { val: tarjeta }, { val: foto1 }, { val: foto2 }];
          sql = 'INSERT INTO FURWEB_METADATO_SR2021 (N_PERIODO,CVE_PROGRAMA,PRIMER_APELLIDO,SEGUNDO_APELLIDO,NOMBRES,NOMBRE_COMPLETO,FECHA_NACIMIENTO,CURP,CVE_LUGAR_NACIMIENTO,CVE_MUNICIPIO,CVE_ENTIDAD_FEDERATIVA,LATITUD,LONGITUD,CVE_BENEFICIO,CANTIDAD,CVE_PERIODICIDAD,TARJETA,FOTO1,FOTO2) VALUES (:periodo,:programa,:AP,:AM,:nombres,:nom_comp,:fec_nac,:CURP,:cve_lugar_nac,:municipio,:cve_ent_fed,:latitud,:longitud,:beneficio,:cantidad,:periodicidad,:tarjeta,:foto1,:foto2)';
          await conn.execute(sql, bindn, { autoCommit: true });
        } else {
          let bindu = [{ val: period }, { val: program }, { val: AP }, { val: AM }, { val: nombres }, { val: nom_comp }, { val: fec_nac }, { val: cve_lugar_nac }, { val: muni }, { val: cve_lugar_nac }, { val: latitud }, { val: longitud }, { val: benef }, { val: cantidad }, { val: periodici }, { val: tarjeta }, { val: foto1 }, { val: foto2 }, { val: CURP }];
          sql = 'UPDATE FURWEB_METADATO_SR2021 SET N_PERIODO = :periodo, CVE_PROGRAMA = :programa, PRIMER_APELLIDO= :AP, SEGUNDO_APELLIDO= :AM, NOMBRES= :nombres, NOMBRE_COMPLETO= :nom_comp, FECHA_NACIMIENTO= :fec_nac, CVE_LUGAR_NACIMIENTO= :cve_lugar_nac, CVE_MUNICIPIO= :municipio, CVE_ENTIDAD_FEDERATIVA= :cve_ent_fed, LATITUD= :latitud, LONGITUD= :longitud, CVE_BENEFICIO= :beneficio, CANTIDAD= :cantidad, CVE_PERIODICIDAD= :periodicidad, TARJETA= :tarjeta, FOTO1= :foto1, FOTO2= :foto2 where CURP = :CURP';
          await conn.execute(sql, bindu, { autoCommit: true });
        }
        await conn.close();
      } catch (err) {
        console.log(err);
      }
      return "Beneficiario Creado Correctamente";
    }
  }
}

process
  .on('SIGTERM', function () {
    console.log("\nTerminating");
    process.exit(0);
  })
  .on('SIGINT', function () {
    console.log("\nTerminating");
    process.exit(0);
  });



  
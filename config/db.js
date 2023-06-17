import oracledb from 'oracledb';
import dotenv from 'dotenv';
dotenv.config({ path: 'variables.env' });

export const conectarDB = async () => {

    let connection;
    try {
        connection = await oracledb.createPool({
            user: process.env.USER,
            password: process.env.PWD,
            connectString: process.env.CS
        });
        console.log("DB CONECTADA");
    } catch (error) {
        console.log('Hubo un error');
        console.log(error);
    }
}


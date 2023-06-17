import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import { graphqlUploadExpress } from "graphql-upload";
import http from 'http'; 
import {typeDefs} from './db/schema.js';
import {resolvers} from './db/resolvers.js';
import {conectarDB} from './config/db.js';
import path from 'path'; 
import {fileURLToPath} from 'url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ path: 'variables.env' });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

conectarDB();

async function startApolloServer(typeDefs, resolvers) {
  
  const app = express();
  
  const httpServer = http.createServer(app);
  
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({req}) => {
      const token = req.headers['authorization'] || '';
      if(token) {
          try {
              const usuario = jwt.verify(token.replace('Bearer ', ''), process.env.SECRETA);
              return {
                  usuario
              }
          } catch (error) {
              console.log(error);
          }
      }
  },
  csrfPrevention: true,
  cache: 'bounded'
  });
  
  await server.start(); 
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 1000 }));
  server.applyMiddleware({ app, path: '/' });
  app.use(express.static(path.join(__dirname, "../imagenes/")));
  await new Promise(resolve => httpServer.listen({ port: process.env.PORT || 4000 }, resolve));
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
}

startApolloServer(typeDefs,resolvers);


🚀 App de Gestión de Ventas y Stock
Una aplicación web completa (Single Page Application) para la gestión de inventario, ventas y usuarios, construida con React y Firebase.

Esta herramienta es ideal para pequeños negocios o emprendedores que necesitan un control rápido de su stock y sus ventas diarias, con la ventaja de una base de datos en la nube y funcionalidades avanzadas como importación/exportación de Excel y procesamiento de pedidos con IA.

✨ Características Principales
🔐 Autenticación de Usuarios: Sistema completo de Registro y Login de usuarios usando Firebase Authentication.

👑 Sistema de Roles:

Admin: Acceso total, incluyendo el panel de gestión de usuarios.

Usuario Free: Acceso a la app con un período de prueba gratuito de 30 días.

📦 Gestión de Inventario:

CRUD completo de productos (Crear, Leer, Editar, Borrar).

El stock se actualiza automáticamente con cada venta o anulación.

🚀 Importación Masiva (Excel):

Carga y actualiza el inventario completo desde un archivo .xlsx.

El sistema valida las columnas (name, costPrice, sellingPrice, stock) y sube los productos en un solo batch a Firestore.

📈 Gestión de Ventas:

Creación de "Nuevas Ventas" desde el inventario.

Historial detallado de todas las ventas.

Anulación de ventas (con reposición automática de stock).

Cambio de estado de la venta (Pendiente/Entregado).

🤖 IA para Pedidos (Gemini):

Procesa pedidos de texto (ej. copiados desde WhatsApp) usando la API de Google Gemini.

Extrae automáticamente los productos y cantidades y los añade al carrito.

📊 Reportes en Excel:

Exporta un reporte .xlsx con el historial completo de ventas, resumen de ganancias por producto y el estado actual del inventario.

👤 Panel de Administración:

Vista exclusiva para el rol "admin".

Permite ver la lista de todos los usuarios registrados, su tipo y el estado de su período de prueba.

Permite eliminar usuarios (borrando sus datos de Firestore).

🛠️ Stack de Tecnologías
Front-End: React.js (v18+)

Back-End & Base de Datos: Firebase (v9+)

Firebase Authentication (para usuarios)

Cloud Firestore (como base de datos NoSQL en tiempo real)

UI / Estilos:

Bootstrap 5 (cargado por CDN)

Bootstrap Icons

APIs y Librerías:

Google Gemini API (para procesamiento de pedidos)

SheetJS (xlsx) (para importación y exportación de Excel, cargado por CDN)

🚀 Puesta en Marcha
Para correr este proyecto localmente, sigue estos pasos:

1. Clonar el Repositorio
Bash

git clone https://github.com/javierzlafe/Control-de-stock-y-ganancias
cd nombre-del-repositorio
2. Instalar Dependencias
Este proyecto fue creado para ser simple, pero asume que tienes un entorno de React (como Vite o Create React App).

Bash

npm install
3. Configurar Firebase (¡Crítico!)
Ve a Firebase y crea un nuevo proyecto.

Activa Authentication y habilita el método de "Correo electrónico/Contraseña".

Activa Cloud Firestore y créala en "modo de prueba" (test mode).

En la configuración de tu proyecto (Project Settings), registra una nueva "App Web".

Copia el objeto firebaseConfig que te proporciona Firebase.

Pega este objeto en tu archivo app.jsx, reemplazando el placeholder:

JavaScript

// app.jsx (Línea 16 aprox.)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  // ...etc
};
Importante: Ve a la pestaña "Reglas" (Rules) de tu Cloud Firestore y reemplaza las reglas por defecto con las siguientes para habilitar el sistema de permisos:

JSON

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function getUserRole(userId) {
      return get(/databases/$(database)/documents/usuarios/$(userId)).data.userType;
    }

    match /usuarios/{userId} {
      allow read, update, create: if request.auth.uid == userId;
      allow list: if getUserRole(request.auth.uid) == 'admin';
    }

    match /usuarios/{userId}/{collection}/{docId} {
      allow read, write: if request.auth.uid == userId;
      allow read, write: if getUserRole(request.auth.uid) == 'admin';
    }
  }
}
4. Configurar Google Gemini API
Ve a Google AI Studio (o Google Cloud) y genera una API Key.

Pega tu clave en la variable GEMINI_API_KEY dentro del componente NewSaleScreen en app.jsx:

JavaScript

// app.jsx (Línea 900 aprox.)
const GEMINI_API_KEY = "TU_CLAVE_DE_GEMINI_AQUI"; 
5. Correr la Aplicación
Bash

npm run dev
# o
npm start
📋 Uso


Importación de Excel
Para que la importación masiva funcione, el archivo .xlsx debe tener una hoja con las siguientes columnas (el nombre debe ser exacto):

name

costPrice

sellingPrice

stock

📄 Propiedad Intelectual
Este proyecto es propiedad de Javier Gimenez.
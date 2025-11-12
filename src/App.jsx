// app.jsx
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';

// --- 1. CONFIGURACIÓN DE FIREBASE ---
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  writeBatch, 
  increment, 
  serverTimestamp, 
  getDocs 
} from "firebase/firestore";

// ⬇️ PEGA TU CONFIG DE FIREBASE AQUÍ ⬇️
const firebaseConfig = {
  apiKey: "AIzaSyCoFF99YGFehQbCUbXlrjGb25EbAGaCXdI",
  authDomain: "gestion-ventas-app-64f18.firebaseapp.com",
  projectId: "gestion-ventas-app-64f18",
  storageBucket: "gestion-ventas-app-64f18.firebasestorage.app",
  messagingSenderId: "273200916717",
  appId: "1:273200916717:web:db24c10e9e013b32af44e4"
};
// ⬆️ PEGA TU CONFIG DE FIREBASE AQUÍ ⬆️

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- 2. CONFIGURACIÓN DE LA APP ---
const ADMIN_USERNAME = 'btech'; // Usuario que se registrará como admin
const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días (MODIFICADO)

// --- 3. CONTEXTO GLOBAL ---
const AppContext = createContext();

// --- 4. PROVIDER (El cerebro de la App) ---
const AppProvider = ({ children }) => {
  // Estado de la app
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Loading de datos (productos/ventas)
  const [currentView, setCurrentView] = useState('home');
  
  // Estado de autenticación y usuarios
  const [users, setUsers] = useState([]); // Para la vista de Admin
  const [currentUser, setCurrentUser] = useState(null); // El usuario logueado
  const [isAuthLoading, setIsAuthLoading] = useState(true); // Loading inicial de usuario
  
  // Estado del Modal
  const [modal, setModal] = useState({ 
    isVisible: false, type: 'alert', message: '', onConfirm: null, onCancel: null 
  });
  
  // --- CARGADOR DE AUTENTICACIÓN ---
  // Escucha cambios de login/logout de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Usuario logueado. Buscamos su perfil en Firestore.
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userProfile = userDocSnap.data();
          
          // Verificar prueba gratuita
          if (userProfile.userType === 'free') {
            const registeredAtTime = userProfile.registeredAt?.toDate ? userProfile.registeredAt.toDate().getTime() : new Date(userProfile.registeredAt || Date.now()).getTime();
            const trialEndTime = registeredAtTime + TRIAL_DURATION_MS; // Usa la variable de 30 días
            if (Date.now() > trialEndTime) {
                // Si la prueba expiró, mostramos alerta y deslogueamos
                setModal({ isVisible: true, type: 'alert', message: 'Tu prueba gratuita de 30 días ha expirado. Contacta al administrador.', onConfirm: () => {
                    signOut(auth);
                    setModal({ isVisible: false });
                }});
                setCurrentUser(null);
                setIsAuthLoading(false);
                return; // Detenemos la ejecución
            }
          }
          
          // Prueba válida o es admin, seteamos el usuario
          setCurrentUser({
            uid: user.uid,
            email: user.email,
            ...userProfile // username, userType, registeredAt
          });

        } else {
          // Error: perfil no encontrado
          setModal({ isVisible: true, type: 'alert', message: 'Error: No se encontró el perfil de usuario. Contacta soporte.', onConfirm: () => {
             signOut(auth);
             setModal({ isVisible: false });
          }});
        }
      } else {
        // No hay usuario logueado
        setCurrentUser(null);
      }
      setIsAuthLoading(false); // Terminamos el loading de autenticación
    });
    
    return () => unsubscribe(); // Limpieza al desmontar
  }, []);

  // --- CARGADOR DE DATOS (PRODUCTOS) ---
  useEffect(() => {
    if (!currentUser) {
      setProducts([]); // Limpiar si no hay usuario
      return;
    }
    
    setIsLoading(true);
    // Ruta a la subcolección: /usuarios/{ID_DE_USUARIO}/productos
    const q = query(collection(db, 'usuarios', currentUser.uid, 'productos'));
    
    // onSnapshot es un listener EN VIVO. Se actualiza solo.
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData = [];
      querySnapshot.forEach((doc) => {
        productsData.push({ ...doc.data(), id: doc.id });
      });
      setProducts(productsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error cargando productos: ", error);
      setIsLoading(false);
    });
    
    return () => unsubscribe(); // Limpieza
  }, [currentUser]); // Se dispara CADA VEZ que currentUser cambia

  // --- CARGADOR DE DATOS (VENTAS) ---
  useEffect(() => {
    if (!currentUser) {
      setSales([]); // Limpiar si no hay usuario
      return;
    }
    
    const q = query(collection(db, 'usuarios', currentUser.uid, 'ventas'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const salesData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        salesData.push({ 
            ...data, 
            id: doc.id,
            date: data.date?.toDate ? data.date.toDate().toISOString() : (data.date || new Date().toISOString())
        });
      });
      setSales(salesData);
    }, (error) => {
      console.error("Error cargando ventas: ", error);
    });
    
    return () => unsubscribe(); // Limpieza
  }, [currentUser]); // Se dispara CADA VEZ que currentUser cambia

  // --- Funciones del Modal Global ---
  const showAlert = (message, onConfirm = () => {}) => {
    setModal({
        isVisible: true,
        type: 'alert',
        message,
        onConfirm: () => {
            onConfirm();
            setModal({ isVisible: false });
        },
        onCancel: null
    });
  };

  const showConfirm = (message, onConfirm, onCancel = () => {}) => {
      setModal({
          isVisible: true,
          type: 'confirm',
          message,
          onConfirm: () => {
              onConfirm();
              setModal({ isVisible: false });
          },
          onCancel: () => {
              onCancel();
              setModal({ isVisible: false });
          }
      });
  };
  
  const closeModal = () => {
    if (modal.onCancel) modal.onCancel();
    setModal({ isVisible: false });
  };
  
  // --- Funciones de Autenticación (Firebase) ---
  
  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setCurrentView('home');
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        showAlert("Email o contraseña incorrecta.");
      } else {
        showAlert("Error al iniciar sesión: " + error.message);
      }
    }
  };
  
  const register = async (username, email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userType = username.toLowerCase() === ADMIN_USERNAME ? 'admin' : 'free';
      const userDocRef = doc(db, "usuarios", user.uid);
      await setDoc(userDocRef, {
        username: username,
        userType: userType,
        registeredAt: serverTimestamp()
      });
      
      setCurrentView('home');
      if(userType === 'free') {
        showAlert("¡Registro exitoso! Tu prueba de 30 días ha comenzado.");
      } else {
        showAlert("¡Registro de Administrador exitoso!");
      }
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        showAlert("El correo electrónico ya está en uso.");
      } else {
        showAlert("Error al registrar: " + error.message);
      }
    }
  };
  
  const logout = () => {
    signOut(auth);
  };
  
  // --- Lógica de Admin (Firebase) ---
  const fetchAllUsers = async () => {
    if (currentUser?.userType !== 'admin') return;
    try {
        const usersSnapshot = await getDocs(collection(db, "usuarios"));
        const usersList = usersSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            registeredAt: doc.data().registeredAt?.toDate ? doc.data().registeredAt.toDate().toISOString() : 'N/A'
        }));
        setUsers(usersList);
    } catch (error) {
        console.error("Error fetching users:", error);
        showAlert("No tienes permiso para ver los usuarios.");
    }
  };
  
  const deleteUserFromAdmin = async (userId, username) => {
    if (userId === currentUser.id) {
      showAlert("No puedes eliminarte a ti mismo.");
      return;
    }
    
    showConfirm(`¿Seguro que quieres borrar TODOS los datos de ${username}? Esto borrará su perfil, productos y ventas de la base de datos (no se puede deshacer).`, async () => {
        try {
            await deleteDoc(doc(db, "usuarios", userId));
            showAlert(`Datos de ${username} eliminados de Firestore.`);
            fetchAllUsers();
        } catch (error) {
            console.error("Error deleting user data:", error);
            showAlert("Error al borrar datos: " + error.message);
        }
    });
  };

  // --- Lógica de Negocio (Firebase) ---
  const getProductsCollection = () => collection(db, 'usuarios', currentUser.uid, 'productos');
  const getSalesCollection = () => collection(db, 'usuarios', currentUser.uid, 'ventas');
  
  const addProduct = async (product) => {
    try {
      await addDoc(getProductsCollection(), product);
    } catch (e) { console.error("Error añadiendo producto: ", e); }
  };
  
  const editProduct = async (updatedProduct) => {
    try {
      const productRef = doc(db, 'usuarios', currentUser.uid, 'productos', updatedProduct.id);
      const { id, ...dataToSave } = updatedProduct;
      await setDoc(productRef, dataToSave);
    } catch (e) { console.error("Error editando producto: ", e); }
  };

  const deleteProduct = async (productId) => {
    if (sales.some(s => s.items.some(item => item.productId === productId))) {
      showAlert("Error: No se puede eliminar un producto que ya ha sido parte de una venta.");
      return false;
    }
    try {
      await deleteDoc(doc(db, 'usuarios', currentUser.uid, 'productos', productId));
      return true;
    } catch (e) {
      console.error("Error borrando producto: ", e);
      return false;
    }
  };
  
  const addSale = async (sale) => {
    try {
      const batch = writeBatch(db);
      const newSaleRef = doc(getSalesCollection());
      batch.set(newSaleRef, { ...sale, date: serverTimestamp() }); 
      
      sale.items.forEach(item => {
        const productRef = doc(db, 'usuarios', currentUser.uid, 'productos', item.productId);
        batch.update(productRef, { stock: increment(-item.quantity) });
      });
      
      await batch.commit();
    } catch (e) {
      console.error("Error al añadir venta: ", e);
      showAlert("Error al registrar la venta.");
    }
  };
  
  const deleteSale = async (saleId) => {
    const saleToDelete = sales.find(s => s.id === saleId);
    if (!saleToDelete) return;
    
    try {
        const batch = writeBatch(db);
        const saleRef = doc(db, 'usuarios', currentUser.uid, 'ventas', saleId);
        batch.delete(saleRef);
        
        saleToDelete.items.forEach(item => {
            const productRef = doc(db, 'usuarios', currentUser.uid, 'productos', item.productId);
            batch.update(productRef, { stock: increment(item.quantity) });
        });
        
        await batch.commit();
        showAlert("Venta anulada y stock devuelto.");
    } catch (e) {
        console.error("Error anulando venta: ", e);
        showAlert("Error al anular la venta.");
    }
  };
  
 // 1. Función NUEVA: Solo borra (sin preguntar).
  // Esta es la que usará el botón de Exportar.
  const executeDeleteAllSales = async () => {
    try {
      const batch = writeBatch(db);
      sales.forEach(sale => {
          const saleRef = doc(getSalesCollection(), sale.id);
          batch.delete(saleRef);
      });
      await batch.commit();
      showAlert("Historial de ventas borrado.");
    } catch (e) {
      console.error("Error borrando historial: ", e);
      showAlert("Error al borrar el historial.");
    }
};

// 2. Función MODIFICADA: Pregunta y luego llama a la anterior.
// Esta es la que usa el botón "Borrar Historial" del menú.
const clearSales = () => {
  showConfirm("¿Seguro que quieres borrar TODO el historial de ventas? NO SE PUEDE RECUPERAR", () => {
      executeDeleteAllSales();
  });
};
  
  const updateSaleStatus = async (saleId, newStatus) => {
    try {
        const saleRef = doc(db, 'usuarios', currentUser.uid, 'ventas', saleId);
        await setDoc(saleRef, { status: newStatus }, { merge: true }); 
    } catch(e) { console.error("Error actualizando estado: ", e); }
  };
  
  return (
    <AppContext.Provider value={{ 
      products, sales, isLoading, currentView, setCurrentView,
      currentUser, users, isAuthLoading,
      login, logout, register, fetchAllUsers, deleteUserFromAdmin,
      modal, closeModal, showAlert, showConfirm,
      addProduct, editProduct,
      addSale, deleteSale, deleteProduct, clearSales, executeDeleteAllSales,
      updateSaleStatus,
      db // (NUEVO) Exponemos 'db' para el importador de Excel
    }}>
      {children}
    </AppContext.Provider>
  );
};

// --- 5. HOOK PERSONALIZADO ---
const useApp = () => useContext(AppContext);

// --- 6. COMPONENTES DE UI ---

const Modal = ({ children, visible, onClose }) => {
    if (!visible) return null;
    return (
      <>
        <div className="modal-backdrop fade show" onClick={onClose}></div>
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" onClick={onClose}>
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 shadow">
              {children}
            </div>
          </div>
        </div>
      </>
    );
};

const GlobalModal = () => {
    const { modal } = useApp();
    if (!modal.isVisible) return null;
    return (
        <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content rounded-4 shadow animate-fade-in-up">
                        <div className="modal-body p-4 text-center">
                            <p className="mb-0 fs-5">{modal.message}</p>
                        </div>
                        <div className="modal-footer flex-nowrap p-0">
                            {modal.type === 'confirm' && (
                                <button
                                    type="button"
                                    className="btn btn-lg btn-link fs-6 text-decoration-none col-6 m-0 rounded-0 border-end"
                                    onClick={modal.onCancel}
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="button"
                                className={`btn btn-lg btn-link fs-6 text-decoration-none col-${modal.type === 'confirm' ? '6' : '12'} m-0 rounded-0 text-primary-emphasis`}
                                onClick={modal.onConfirm}
                            >
                                {modal.type === 'confirm' ? 'Confirmar' : 'Aceptar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const LoadingSpinner = () => (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
        </div>
    </div>
);


// --- 7. PANTALLAS DE LA APP ---

const LoginScreen = () => {
  const { login, register, showAlert } = useApp();
  const [authView, setAuthView] = useState('login');
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [validated, setValidated] = useState(false);
  const formRef = useRef(null);
  
  const handleLogin = (event) => {
    event.preventDefault();
    if (!formRef.current.checkValidity()) {
      event.stopPropagation();
      setValidated(true);
      return;
    }
    login(email, password);
  };
  
  const handleRegister = (event) => {
    event.preventDefault();
    if (!formRef.current.checkValidity()) {
      event.stopPropagation();
      setValidated(true);
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Las contraseñas no coinciden.");
      return;
    }
    register(username, email, password);
  };
  
  const switchView = (view) => {
    setAuthView(view);
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setValidated(false);
  };

  return (
    <div className="container vh-100 d-flex flex-column justify-content-center">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="card shadow-lg border-0 rounded-4">
            {authView === 'login' ? (
              <div className="card-body p-4 p-sm-5">
                <h2 className="card-title text-center fw-bold h3 mb-4">Iniciar Sesión</h2>
                <form 
                  ref={formRef} 
                  noValidate 
                  className={validated ? 'was-validated' : ''} 
                  onSubmit={handleLogin}
                >
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input 
                      type="email" 
                      className="form-control form-control-lg" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required 
                    />
                    <div className="invalid-feedback">El email es requerido.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Contraseña</label>
                    <input 
                      type="password" 
                      className="form-control form-control-lg" 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required 
                    />
                    <div className="invalid-feedback">La contraseña es requerida.</div>
                  </div>
                  <div className="d-grid gap-3 mt-4">
                    <button type="submit" className="btn btn-primary btn-lg">
                      Ingresar
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-success btn-lg"
                      onClick={() => switchView('register')}
                    >
                      Prueba gratuita por 30 días
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="card-body p-4 p-sm-5">
                <h2 className="card-title text-center fw-bold h3 mb-4">Registro (Prueba 30 Días)</h2>
                <form 
                  ref={formRef} 
                  noValidate 
                  className={validated ? 'was-validated' : ''} 
                  onSubmit={handleRegister}
                >
                  <div className="mb-3">
                    <label className="form-label">Nombre de Usuario</label>
                    <input 
                      type="text" 
                      className="form-control form-control-lg" 
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required 
                    />
                    <div className="invalid-feedback">Elige un nombre de usuario.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input 
                      type="email" 
                      className="form-control form-control-lg" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required 
                    />
                    <div className="invalid-feedback">Tu email (para iniciar sesión).</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Contraseña</label>
                    <input 
                      type="password" 
                      className="form-control form-control-lg" 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required 
                      minLength="6"
                    />
                    <div className="invalid-feedback">La contraseña debe tener al menos 6 caracteres.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Confirmar Contraseña</label>
                    <input 
                      type="password" 
                      className="form-control form-control-lg" 
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required 
                    />
                    <div className="invalid-feedback">Confirma tu contraseña.</div>
                  </div>
                  <div className="d-grid gap-3 mt-4">
                    <button type="submit" className="btn btn-success btn-lg">
                      Registrarme
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={() => switchView('login')}
                    >
                      ¿Ya tienes cuenta? Iniciar Sesión
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const HomeScreen = () => {
  const { sales, isLoading, setCurrentView, currentUser } = useApp();
  if (isLoading) return <LoadingSpinner />;

  const today = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.date.startsWith(today));
  const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = todaySales.reduce((sum, s) => sum + s.profit, 0);
  const pendingSales = sales.filter(s => s.status === 'Pendiente').length;

  return (
    <div className="p-3 p-md-4">
      <header className="text-center mb-4">
        <h1 className="h3 fw-bold text-dark">Resumen del Día</h1>
        <p className="text-muted mb-0">
          {new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
          })}
        </p>
      </header>
      
      <div className="row row-cols-1 row-cols-sm-2 g-3 mb-4">
        <div className="col">
          <div className="card card-body text-center shadow-sm rounded-3 border-0 h-100">
            <i className="bi bi-cash-stack fs-1 text-primary"></i>
            <p className="text-muted small mt-2 mb-0">Ventas de Hoy</p>
            <p className="h4 fw-bold text-dark mt-1 mb-0">${totalRevenue.toFixed(2)}</p>
          </div>
        </div>
        <div className="col">
          <div className="card card-body text-center shadow-sm rounded-3 border-0 h-100">
            <i className="bi bi-graph-up-arrow fs-1 text-success"></i>
            <p className="text-muted small mt-2 mb-0">Ganancia de Hoy</p>
            <p className="h4 fw-bold text-dark mt-1 mb-0">${totalProfit.toFixed(2)}</p>
          </div>
        </div>
      </div>
      
      {pendingSales > 0 && (
        <div className="card card-body shadow-sm rounded-3 border-0 mb-4">
            <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                    <i className="bi bi-box-seam fs-2 text-warning"></i>
                    <p className="ms-3 mb-0 fw-semibold text-dark">Pedidos Pendientes</p>
                </div>
                <p className="h4 fw-bold text-warning-emphasis mb-0">{pendingSales}</p>
            </div>
        </div>
      )}
      
      <div className="d-grid gap-3">
        <button onClick={() => setCurrentView('new_sale')} className="btn btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2">
            <i className="bi bi-cart-plus-fill"></i>
            <span>Cargar Venta</span>
        </button>
        <button onClick={() => setCurrentView('inventory')} className="btn btn-outline-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2">
            <i className="bi bi-list-check"></i>
            <span>Inventario</span>
        </button>
        <button onClick={() => setCurrentView('history')} className="btn btn-outline-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2">
            <i className="bi bi-clock-history"></i>
            <span>Historial de Ventas</span>
        </button>
        
        {currentUser.userType === 'admin' && (
          <button onClick={() => setCurrentView('admin_users')} className="btn btn-outline-danger btn-lg w-100 d-flex align-items-center justify-content-center gap-2">
              <i className="bi bi-people-fill"></i>
              <span>Administrar Usuarios</span>
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Pantalla de Inventario (¡MODIFICADA con Importar Excel!)
 */
/**
 * Pantalla de Inventario (¡MODIFICADA con botón "Agregar" en la parte superior!)
 */
const InventoryScreen = () => {
  const { products, addProduct, editProduct, deleteProduct, showConfirm, showAlert, db, currentUser } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentProduct, setCurrentProduct] = useState({ id: null, name: '', costPrice: '', sellingPrice: '', stock: '' });
  const [validated, setValidated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef(null);
  
  // --- Lógica para Importar Excel ---
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileImport = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const data = event.target.result;
              const workbook = window.XLSX.read(data, { type: 'binary' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const jsonProducts = window.XLSX.utils.sheet_to_json(worksheet);
              
              uploadProductsToFirebase(jsonProducts);

          } catch (error) {
              console.error("Error al leer el archivo:", error);
              showAlert("Error al leer el archivo. Asegúrate de que tenga el formato correcto.");
              setIsUploading(false);
          } finally {
              if(fileInputRef.current) fileInputRef.current.value = "";
          }
      };
      reader.readAsBinaryString(file);
  };

  const uploadProductsToFirebase = async (products) => {
      if (!products || products.length === 0) {
          showAlert("El archivo está vacío o no se pudo leer.");
          setIsUploading(false);
          return;
      }

      const requiredCols = ['name', 'costPrice', 'sellingPrice', 'stock'];
      const firstProduct = products[0];
      const hasAllCols = requiredCols.every(col => firstProduct.hasOwnProperty(col));

      if (!hasAllCols) {
          showAlert(`Error: El archivo Excel debe tener estas columnas exactas: ${requiredCols.join(', ')}`);
          setIsUploading(false);
          return;
      }

      try {
          const batch = writeBatch(db);
          const productsCollection = collection(db, 'usuarios', currentUser.uid, 'productos');
          let importedCount = 0;
          
          products.forEach(product => {
              const costPrice = parseFloat(product.costPrice);
              const sellingPrice = parseFloat(product.sellingPrice);
              const stock = parseInt(product.stock, 10);

              if (isNaN(costPrice) || isNaN(sellingPrice) || isNaN(stock) || !product.name) {
                  console.warn("Producto saltado por datos inválidos:", product);
                  return; 
              }
              
              const newProductRef = doc(productsCollection);
              batch.set(newProductRef, {
                  name: String(product.name),
                  costPrice: costPrice,
                  sellingPrice: sellingPrice,
                  stock: stock
              });
              importedCount++;
          });

          await batch.commit();
          showAlert(`¡Éxito! Se importaron ${importedCount} productos nuevos al inventario.`);
      
      } catch (error) {
          console.error("Error al subir el batch a Firebase:", error);
          showAlert("Error al guardar los productos en la base de datos.");
      } finally {
          setIsUploading(false);
      }
  };
  // --- FIN: Lógica para Importar Excel ---

  const openModal = (product = null) => {
      if (product) {
          setCurrentProduct({ ...product, costPrice: String(product.costPrice), sellingPrice: String(product.sellingPrice), stock: String(product.stock) });
          setIsEditMode(true);
      } else {
          setCurrentProduct({ id: null, name: '', costPrice: '', sellingPrice: '', stock: '' });
          setIsEditMode(false);
      }
      setValidated(false);
      setIsSaving(false);
      setModalVisible(true);
  };

  const handleSaveProduct = async (event) => {
      event.preventDefault();
      const form = formRef.current;
      if (!form.checkValidity()) {
          event.stopPropagation();
          setValidated(true);
          return;
      }
      setIsSaving(true);
      const productData = { 
          name: currentProduct.name, 
          costPrice: parseFloat(currentProduct.costPrice), 
          sellingPrice: parseFloat(currentProduct.sellingPrice), 
          stock: parseInt(currentProduct.stock, 10) 
      };
      try {
          if (isEditMode) {
              await editProduct({ ...productData, id: currentProduct.id });
          } else {
              await addProduct(productData);
          }
          setModalVisible(false);
      } catch (error) {
          showAlert("Error al guardar: " + error.message);
      } finally {
          setIsSaving(false);
      }
  };
  
  const confirmDelete = (e, productId) => {
      e.stopPropagation();
      showConfirm("¿Estás seguro de que quieres eliminar este producto?", async () => {
        const success = await deleteProduct(productId);
        if(success && isEditMode && currentProduct.id === productId) {
          setModalVisible(false);
        }
      });
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentProduct(p => ({ ...p, [name]: value }));
  };

  return (
      // --- DIV MODIFICADO --- 
      // (Quitamos position-relative y paddingBottom)
      <div style={{ paddingBottom: '20px' }}> 
          <div className="p-3">
            
            {/* --- BOTÓN "AGREGAR PRODUCTO" (NUEVA POSICIÓN) --- */}
            <button 
                className="btn btn-primary w-100 mb-3 d-flex align-items-center justify-content-center gap-2"
                onClick={() => openModal()}
                disabled={isUploading} // Deshabilitado mientras se importa
            >
                <i className="bi bi-plus-lg"></i>
                <span>Agregar Producto</span>
            </button>

            {/* --- Botón de Importar (ya existe) --- */}
            <button 
                className="btn btn-outline-success w-100 mb-3 d-flex align-items-center justify-content-center gap-2" 
                onClick={() => fileInputRef.current.click()}
                disabled={isUploading}
            >
                {isUploading ? (
                    <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        <span>Importando...</span>
                    </>
                ) : (
                    <>
                        <i className="bi bi-file-earmark-arrow-up-fill"></i>
                        Importar desde Excel
                    </>
                )}
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileImport}
                accept=".xlsx, .xls"
            />
            
            {/* --- Separador --- */}
            <hr className="my-3" /> 

            {products.length === 0 && !isUploading ? (
              <p className="text-center text-muted mt-5">No hay productos en el inventario.</p>
            ) : (
              <div className="list-group">
                {products.map(item => (
                  <div key={item.id} onClick={() => openModal(item)} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center cursor-pointer">
                    <div className="flex-grow-1 me-3">
                      <p className="fw-semibold text-dark mb-0">{item.name}</p>
                      <p className="text-muted small mb-0">
                        Precio: ${item.sellingPrice.toFixed(2)} | Costo: ${item.costPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="d-flex align-items-center">
                      <div className="text-center bg-primary-subtle text-primary-emphasis rounded-3 p-2" style={{minWidth: '70px'}}>
                        <p className="h4 mb-0 fw-bold">{item.stock}</p>
                        <p className="small mb-0" style={{fontSize: '0.7rem'}}>en Stock</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* --- BOTÓN FLOTANTE ELIMINADO --- */}
          
          <Modal visible={modalVisible} onClose={() => setModalVisible(false)}>
            <form 
              ref={formRef} 
              noValidate 
              className={validated ? 'was-validated' : ''} 
              onSubmit={handleSaveProduct}
            >
              <div className="modal-header">
                <h5 className="modal-title">{isEditMode ? 'Editar Producto' : 'Nuevo Producto'}</h5>
                <button type="button" className="btn-close" onClick={() => setModalVisible(false)} disabled={isSaving}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Nombre del producto</label>
                  <input name="name" placeholder="Ej: Botella 1.5L" className="form-control" value={currentProduct.name} onChange={handleChange} required disabled={isSaving} />
                  <div className="invalid-feedback">El nombre es obligatorio.</div>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col">
                    <label className="form-label">Precio de costo</label>
                    <input name="costPrice" type="number" step="0.01" min="0" placeholder="0.00" className="form-control" value={currentProduct.costPrice} onChange={handleChange} required disabled={isSaving} />
                    <div className="invalid-feedback">Campo requerido.</div>
                  </div>
                  <div className="col">
                    <label className="form-label">Precio de venta</label>
                    <input name="sellingPrice" type="number" step="0.01" min="0" placeholder="0.00" className="form-control" value={currentProduct.sellingPrice} onChange={handleChange} required disabled={isSaving} />
                    <div className="invalid-feedback">Campo requerido.</div>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Stock</label>
                  <input name="stock" type="number" step="1" min="0" placeholder="0" className="form-control" value={currentProduct.stock} onChange={handleChange} required disabled={isSaving} />
                  <div className="invalid-feedback">El stock es requerido.</div>
                </div>
              </div>
              <div className="modal-footer d-flex">
                {isEditMode && 
                  <button type="button" className="btn btn-outline-danger me-auto" onClick={(e) => confirmDelete(e, currentProduct.id)} disabled={isSaving}>
                    Eliminar
                  </button>
                }
                <button type="button" className="btn btn-secondary" onClick={() => setModalVisible(false)} disabled={isSaving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? (
                      <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          <span className="ms-1">Guardando...</span>
                      </>
                  ) : 'Guardar'}
                </button>
              </div>
            </form>
          </Modal>
      </div>
  );
};

const NewSaleScreen = () => {
    const { products, addSale, setCurrentView, showAlert } = useApp();
    const [cart, setCart] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const GEMINI_API_KEY = ""; 

    const handlePasteAndProcessOrder = async () => {
        setIsProcessing(true);
        try {
            const text = await navigator.clipboard.readText();
            if (!text) { 
              showAlert("El portapapeles está vacío."); 
              setIsProcessing(false);
              return; 
            }

            const availableProducts = products.map(p => p.name);
            const prompt = `Analiza el pedido y extrae productos y cantidades. Reglas: 1. Solo devuelve productos de esta lista: [${availableProducts.join(", ")}]. 2. Ignora lo que no esté en la lista. 3. Ignora saludos y otra conversación. 4. Tu respuesta DEBE ser solo un JSON. Pedido: "${text}"`;
            
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const payload = {
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      "productName": { "type": "STRING" },
                      "quantity": { "type": "NUMBER" }
                    }
                  }
                }
              }
            };

            const response = await fetch(apiUrl, { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify(payload) 
            });
            
            if (!response.ok) throw new Error(`Error de API: ${response.statusText}`);
            const result = await response.json();
            
            const jsonText = result.candidates[0].content.parts[0].text;
            const parsedOrder = JSON.parse(jsonText);
            let newCart = [...cart];
            let addedCount = 0;
            let notFound = [];

            parsedOrder.forEach(orderItem => {
                const product = products.find(p => p.name.toLowerCase() === orderItem.productName.toLowerCase());
                if (product) {
                    const quantity = orderItem.quantity;
                    const itemInCart = newCart.find(item => item.productId === product.id);
                    const currentQuantity = itemInCart ? itemInCart.quantity : 0;
                    
                    if (quantity + currentQuantity <= product.stock) {
                      if(itemInCart) {
                        itemInCart.quantity += quantity;
                      } else {
                        newCart.push({ ...product, productId: product.id, quantity });
                      }
                      addedCount++;
                    } else {
                      showAlert(`Stock insuficiente para ${product.name}. Solo quedan ${product.stock}.`);
                    }
                } else {
                  notFound.push(orderItem.productName);
                }
            });
            setCart(newCart);
            let alertMessage = `Se agregaron ${addedCount} productos al carrito.`;
            if(notFound.length > 0) {
              alertMessage +=  ` No se encontraron: ${notFound.join(', ')}.`;
            }
            showAlert(alertMessage);

        } catch (error) {
            console.error("Error procesando pedido:", error);
            showAlert(`Error al procesar el pedido: ${error.message}. Asegúrate de que el texto copiado sea un pedido.`);
        } finally { 
          setIsProcessing(false); 
        }
    };

    const addToCart = (product) => {
        const itemInCart = cart.find(item => item.productId === product.id);
        if (itemInCart) {
            if (itemInCart.quantity < product.stock) setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
            else showAlert(`No puedes agregar más ${product.name}. Stock máximo alcanzado.`);
        } else if (product.stock > 0) setCart([...cart, { ...product, productId: product.id, quantity: 1 }]);
    };
    
    const removeFromCart = (productId) => {
        const itemInCart = cart.find(item => item.productId === productId);
        if (itemInCart.quantity > 1) setCart(cart.map(item => item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item));
        else setCart(cart.filter(item => item.productId !== productId));
    };

    const handleConfirmSale = async () => {
        if (cart.length === 0) { showAlert("El carrito está vacío."); return; }
        if (!customerName.trim()) { showAlert("Por favor, ingresa el nombre del cliente."); return; }
        
        setIsSaving(true);
        const total = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
        const totalCost = cart.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
        
        try {
            await addSale({ 
              items: cart.map(i => ({ 
                productId: i.productId, 
                productName: i.name,
                quantity: i.quantity, 
                price: i.sellingPrice,
                cost: i.costPrice
              })), 
              total, 
              profit: total - totalCost, 
              customerName: customerName.trim(), 
              status: 'Pendiente' 
            });
            
            showAlert(`Venta para ${customerName.trim()} registrada. Total: $${total.toFixed(2)}`, () => {
                setCurrentView('history');
            });
        } catch (error) {
            showAlert("Error al guardar la venta: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };
    
    const totalVenta = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
    const productsInStock = products.filter(p => p.stock > 0);

    return (
        <div className="d-flex flex-column new-sale-layout">
          <div className="p-3 border-bottom">
            <button onClick={handlePasteAndProcessOrder} disabled={isProcessing || isSaving} className="btn btn-success btn-lg w-100 d-flex align-items-center justify-content-center gap-2">
              {isProcessing ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                <i className="bi bi-clipboard-plus-fill"></i>
              )}
              <span>{isProcessing ? 'Procesando...' : 'Pegar Pedido de WhatsApp'}</span>
            </button>
          </div>
          
          <div className="row g-0 flex-grow-1" style={{ minHeight: '0' }}>
            <div className="col-6 d-flex flex-column border-end">
              <h2 className="h5 mb-0 p-3 border-bottom">Productos</h2>
              <div className="overflow-y-auto flex-grow-1">
                {productsInStock.length === 0 ? (
                  <p className="text-center text-muted p-3">No hay productos con stock.</p>
                ) : (
                  <div className="list-group list-group-flush">
                    {productsInStock.map(item => (
                      <button 
                        key={item.id} 
                        onClick={() => addToCart(item)} 
                        type="button" 
                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                        disabled={isSaving}
                      >
                        <div>
                          <span className="fw-semibold">{item.name}</span>
                          <span className="text-muted ms-2">({item.stock})</span>
                        </div>
                        <span className="text-dark fw-bold">${item.sellingPrice.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="col-6 d-flex flex-column bg-light">
              <h2 className="h5 mb-0 p-3 border-bottom">Carrito</h2>
              <div className="overflow-y-auto p-3 flex-grow-1">
                {cart.length === 0 ? (
                  <p className="text-center text-muted mt-4">El carrito está vacío.</p>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {cart.map(item => (
                      <div key={item.productId} className="card card-body shadow-sm border-0 p-2">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <p className="fw-semibold mb-0">{item.name}</p>
                            <p className="text-muted small mb-0">
                              ${item.sellingPrice.toFixed(2)} x {item.quantity} = <strong>${(item.sellingPrice * item.quantity).toFixed(2)}</strong>
                            </p>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <button onClick={() => removeFromCart(item.productId)} className="btn btn-sm btn-outline-danger rounded-circle" style={{ width: '30px', height: '30px', lineHeight: '1' }} disabled={isSaving}>
                              <i className="bi bi-dash-lg"></i>
                            </button>
                            <span className="fw-bold mx-1">{item.quantity}</span>
                            <button onClick={() => addToCart(item)} className="btn btn-sm btn-outline-success rounded-circle" style={{ width: '30px', height: '30px', lineHeight: '1' }} disabled={isSaving}>
                              <i className="bi bi-plus-lg"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <footer className="p-3 border-top bg-white shadow-lg">
            <div className="mb-3">
              <label htmlFor="customerNameInput" className="form-label fw-semibold">Nombre del Cliente</label>
              <input 
                type="text" 
                id="customerNameInput"
                placeholder="Escribe el nombre aquí..." 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)} 
                className="form-control form-control-lg"
                disabled={isSaving} 
              />
            </div>
            <div className="text-center mb-3">
              <span className="h3 fw-bold">Total: ${totalVenta.toFixed(2)}</span>
            </div>
            <button onClick={handleConfirmSale} className="btn btn-primary btn-lg w-100" disabled={isSaving || cart.length === 0}>
              {isSaving ? (
                  <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span className="ms-1">Confirmando...</span>
                  </>
              ) : 'Confirmar Venta'}
            </button>
          </footer>
        </div>
    );
};

const HistoryScreen = () => {
    const { sales, deleteSale, products, clearSales, updateSaleStatus, showAlert, showConfirm, currentUser,executeDeleteAllSales } = useApp();

    const handleExport = () => {
        if (typeof window.XLSX === 'undefined') {
            showAlert("La librería de exportación no está lista. Inténtalo de nuevo en un momento.");
            return;
        }
        try {
            if (sales.length === 0) { showAlert("No hay ventas para exportar."); return; }
            const today = new Date().toISOString().split('T')[0];
            
            const profitByProduct = {};
            sales.forEach(sale => {
                sale.items.forEach(item => {
                    const itemProfit = (item.price - item.cost) * item.quantity;
                    const productName = item.productName || 'Producto Borrado';
                    profitByProduct[productName] = (profitByProduct[productName] || 0) + itemProfit;
                });
            });

            const totalDailyRevenue = sales.reduce((sum, s) => sum + s.total, 0);
            const totalDailyProfit = sales.reduce((sum, s) => sum + s.profit, 0);
            
            const productsData = products.map(p => ({ 
              ID: p.id, Nombre: p.name, Costo: p.costPrice, "Precio Venta": p.sellingPrice, Stock: p.stock 
            }));
            
            const allSalesData = sales.map(s => {
                const itemsStr = s.items.map(item => {
                    return `${item.productName || 'N/A'} (x${item.quantity})`;
                }).join(', ');
                return { 
                  "ID Venta": s.id, Fecha: new Date(s.date).toLocaleString(), Cliente: s.customerName, 
                  Estado: s.status, Items: itemsStr, Total: s.total, Ganancia: s.profit 
                };
            });

            const summaryData = [
                ["Resumen General de Ventas:", currentUser.username], ["Fecha de Exportación:", new Date().toLocaleDateString('es-ES')], [],
                ["Ganancia por Producto (Total)"], ["Producto", "Ganancia Total"],
                ...Object.entries(profitByProduct), [],
                ["Totales Históricos"], 
                ["Venta Total", totalDailyRevenue], 
                ["Ganancia Total", totalDailyProfit]
            ];

            const wb = window.XLSX.utils.book_new();
            const wsSummary = window.XLSX.utils.aoa_to_sheet(summaryData);
            const wsSales = window.XLSX.utils.json_to_sheet(allSalesData);
            const wsProducts = window.XLSX.utils.json_to_sheet(productsData);
            
            wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }];
            wsSales['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 10 }];
            wsProducts['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
            
            window.XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen General");
            window.XLSX.utils.book_append_sheet(wb, wsSales, "Historial Ventas");
            window.XLSX.utils.book_append_sheet(wb, wsProducts, "Inventario");

            const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_${currentUser.username}_${today}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);

            showConfirm("Exportación exitosa. ¿Deseas borrar TODO el historial de ventas?", executeDeleteAllSales);
        } catch (error) {
            console.error("Error al exportar:", error);
            showAlert(`Error al exportar: ${error.message}`);
        }
    };

    return (
        <div className="p-3">
            <button onClick={handleExport} className="btn btn-success btn-lg w-100 d-flex align-items-center justify-content-center gap-2 mb-3">
                <i className="bi bi-file-earmark-excel-fill"></i>
                <span>Exportar Historial</span>
            </button>
            
            {sales.length === 0 ? (
              <p className="text-center text-muted mt-5">No hay ventas registradas.</p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {[...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).map(item => (
                  <div key={item.id} className="card shadow-sm border-0">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <p className="fw-bold h5 text-dark mb-0">{item.customerName}</p>
                          <p className="text-muted small mb-2">{new Date(item.date).toLocaleString()}</p>
                          <span className={`badge rounded-pill ${item.status === 'Entregado' ? 'text-bg-success' : 'text-bg-warning'}`}>
                            {item.status}
                          </span>
                        </div>
                        <button onClick={() => showConfirm("¿Estás seguro de que quieres anular esta venta? El stock será devuelto.", () => deleteSale(item.id))} className="btn btn-link text-danger p-1 ms-2">
                            <i className="bi bi-trash-fill fs-5"></i>
                        </button>
                      </div>
                      
                      <div className="mt-2 pt-2 border-top">
                        <p className="text-muted small mb-1">
                          <strong>Productos:</strong> {item.items.map(saleItem => { 
                            return `${saleItem.productName || 'N/A'} (x${saleItem.quantity})`; 
                          }).join(', ')}
                        </p>
                        <p className="fw-semibold text-dark mb-0">
                          Total: ${item.total.toFixed(2)} | Ganancia: ${item.profit.toFixed(2)}
                        </p>
                      </div>
                      
                      {item.status === 'Pendiente' && (
                        <button onClick={() => updateSaleStatus(item.id, 'Entregado')} className="btn btn-primary w-100 mt-3">
                          Marcar como Entregado
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
    );
};

const AdminUsersScreen = () => {
  const { users, fetchAllUsers, deleteUserFromAdmin, currentUser } = useApp();
  
  useEffect(() => {
    fetchAllUsers();
  }, []);
  
  const getTrialStatus = (user) => {
    if (user.userType === 'admin') return <span className="text-primary fw-bold">Admin</span>;
    
    const registeredAtTime = new Date(user.registeredAt).getTime();
    if (!registeredAtTime) return <span className="text-muted">Fecha inválida</span>;
    
    const trialEndTime = registeredAtTime + TRIAL_DURATION_MS; // Usa la variable de 30 días
    const remainingTime = trialEndTime - Date.now();
    
    if (remainingTime <= 0) {
      return <span className="text-danger">Prueba Expirada</span>;
    }
    
    const daysLeft = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
    return <span className="text-success">{`Usuario Free (Quedan ${daysLeft} días)`}</span>;
  };

  return (
    <div className="p-3">
      {users.length === 0 ? (
        <p className="text-center text-muted mt-5">No hay usuarios registrados.</p>
      ) : (
        <div className="list-group">
          {users.map(user => (
            <div key={user.id} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <p className="fw-semibold text-dark mb-0">{user.username}</p>
                <p className="small mb-0">
                  {getTrialStatus(user)}
                </p>
                <p className="text-muted small mb-0">
                  Registrado: {user.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              {user.id !== currentUser.id && user.username !== ADMIN_USERNAME && (
                <button 
                  onClick={() => deleteUserFromAdmin(user.id, user.username)} 
                  className="btn btn-outline-danger btn-sm"
                >
                  <i className="bi bi-trash-fill"></i>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// --- 8. COMPONENTE "ROUTER" PRINCIPAL ---
function App() {
  const { currentView, setCurrentView, currentUser, isAuthLoading, isLoading, logout } = useContext(AppContext);

  if (isAuthLoading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <LoadingSpinner />
      </div>
    );
  }
  
  if (!currentUser) {
    return (
      <div className="app-container">
        <LoginScreen />
      </div>
    );
  }
  
  const getTitle = () => {
    switch (currentView) {
        case 'inventory': return 'Inventario';
        case 'new_sale': return 'Nueva Venta';
        case 'history': return 'Historial de Ventas';
        case 'admin_users': return 'Administrar Usuarios';
        default: return 'Gestión de Ventas';
    }
  }

  return (
    <div className="app-container">
      <header className="bg-primary text-white p-3 d-flex align-items-center shadow-sm">
        {currentView !== 'home' && (
            <button onClick={() => setCurrentView('home')} className="btn btn-link text-white p-0 me-3">
                <i className="bi bi-arrow-left-circle fs-3"></i>
            </button>
        )}
        <h1 className="h4 mb-0 fw-bold">{getTitle()}</h1>
        
        <button onClick={logout} className="btn btn-link text-white p-0 ms-auto" title="Cerrar Sesión">
          <i className="bi bi-box-arrow-right fs-3"></i>
        </button>
      </header>
      
      <main className="flex-grow-1 overflow-y-auto">
        {isLoading && currentView !== 'new_sale' && currentView !== 'history' ? <LoadingSpinner /> : (() => {
            switch (currentView) {
                case 'inventory': return <InventoryScreen />;
                case 'new_sale': return <NewSaleScreen />;
                case 'history': return <HistoryScreen />;
                case 'admin_users': return <AdminUsersScreen />;
                default: return <HomeScreen />;
            }
        })()}
      </main>
    </div>
  );
}

// --- 9. EXPORTACIÓN PRINCIPAL (APP WRAPPER) ---
export default function AppWrapper() {
    
    // Cargar librerías externas
    useEffect(() => {
        const fontLink = document.createElement('link');
        fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
        fontLink.rel = "stylesheet";
        
        const bsCssLink = document.createElement('link');
        bsCssLink.href = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";
        bsCssLink.rel = "stylesheet";
        
        const bsIconsLink = document.createElement('link');
        bsIconsLink.href = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
        bsIconsLink.rel = "stylesheet";

        const bsJsScript = document.createElement('script');
        bsJsScript.src = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js";
        bsJsScript.async = true;

        // ¡IMPORTANTE! Esta es la librería para leer/escribir Excel
        const xlsxScript = document.createElement('script');
        xlsxScript.src = "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js";
        xlsxScript.async = true;

        document.head.appendChild(fontLink);
        document.head.appendChild(bsCssLink);
        document.head.appendChild(bsIconsLink);
        document.body.appendChild(bsJsScript);
        document.body.appendChild(xlsxScript);

        return () => {
            document.head.removeChild(fontLink);
            document.head.removeChild(bsCssLink);
            document.head.removeChild(bsIconsLink);
            if (document.body.contains(bsJsScript)) document.body.removeChild(bsJsScript);
            if (document.body.contains(xlsxScript)) document.body.removeChild(xlsxScript);
        }
    }, []);

    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          body {
            font-family: 'Inter', sans-serif;
            background-color: #f0f2f5;
          }
          
          .app-wrapper {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 0;
            min-height: 100vh;
            width: 100%;
          }
          
          .app-container {
            width: 100%;
            margin: 0 auto;
            background-color: #ffffff;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            max-height: 100vh;
            border: none;
            border-radius: 0;
            box-shadow: none;
            overflow: hidden;
          }

          .app-container main {
            flex-grow: 1;
            overflow-y: auto;
          }
          
          .new-sale-layout {
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          @media (min-width: 768px) {
            .app-wrapper {
              padding: 2rem 1rem;
            }

            .app-container {
              max-width: 960px;
              width: 100%;
              border: 1px solid #dee2e6;
              border-radius: 0.5rem;
              box-shadow: 0 0.5rem 1.5rem rgba(0,0,0,0.05);
              min-height: 90vh;
              max-height: 90vh;
              height: auto; 
            }
          }
          
          @media (min-width: 1200px) {
            .app-container {
              max-width: 1140px;
            }
          }

          .cursor-pointer {
            cursor: pointer;
          }

          .list-group-item-action {
            transition: background-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
          }
          .list-group-item-action:hover {
            background-color: #f8f9fa;
            box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.04);
            transform: translateY(-1px);
          }
          
          @keyframes fadeIn-up {
            from {
              opacity: 0;
              transform: translate3d(0, 15px, 0);
            }
            to {
              opacity: 1;
              transform: translate3d(0, 0, 0);
            }
          }
          .animate-fade-in-up {
            animation: fadeIn-up 0.3s ease-out;
          }
        `}</style>        
        <div className="app-wrapper">
          <AppProvider>
            <App />
            <GlobalModal />
          </AppProvider>
        </div>
      </>
    );
}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Global Variables (provided by Canvas environment)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let firebaseApp;
let db;
let auth;
let currentUserId = null;

// --- DATA STORE (Based on "paso-guion-campana") ---
let state = {
    phases: [
        {
            id: 1,
            name: 'Fase 1: El Gran P.A.S.O. Inicial',
            description: 'Introducir a P.A.S.O., generar intriga y comenzar a sembrar la parodia.',
            tasks: [
                { id: 1, title: 'Crear perfiles RRSS de P.A.S.O. (anónimo)', status: 'Completada' },
                { id: 2, title: 'Diseñar logo y eslogan amable de P.A.S.O.', status: 'Completada' },
                { id: 3, title: 'Publicar "El Expediente de Quejas del Buen Conformista"', status: 'En Progreso' },
            ]
        },
        {
            id: 2,
            name: 'Fase 2: El P.A.S.O. al Frente (o hacia el Sofá)',
            description: 'Intensificar la parodia, aumentar la identificación y generar debate.',
            tasks: [
                { id: 4, title: 'Publicar "Los Días Extra por Paciencia Extrema"', status: 'Pendiente' },
                { id: 5, title: 'Lanzar encuesta "¿Eres un \'PASO-Conformista\'?"', status: 'Pendiente' },
                { id: 6, title: 'Crear vídeo corto "P.O.R.H. ¡Optimiza tu inacción!"', status: 'Pendiente' },
            ]
        },
        {
            id: 3,
            name: 'Fase 3: El Último P.A.S.O.',
            description: 'La gran revelación y el giro hacia el sindicato real.',
            tasks: [
                { id: 7, title: 'Preparar mensaje final de "despertar"', status: 'Pendiente' },
                { id: 8, title: 'Diseñar micrositio con propuestas REALES del sindicato', status: 'Pendiente' },
            ]
        }
    ],
    gallery: [],
    activeTab: 'dashboard',
    progressChartInstance: null
};

// --- UTILITY FUNCTIONS ---
const showModal = (message, title = "Información") => {
    const modalHtml = `
        <div id="customModal" class="modal-backdrop fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 opacity-0 transition-opacity duration-300">
            <div class="modal-content bg-white p-6 rounded-lg shadow-xl max-w-sm mx-auto transform -translate-y-10 scale-95 transition-all duration-300">
                <h3 class="text-lg font-bold mb-3 text-slate-800">${title}</h3>
                <p class="text-slate-700 mb-6">${message}</p>
                <button id="modalCloseBtn" class="w-full bg-violet-600 text-white font-bold py-2 px-4 rounded-md hover:bg-violet-700 transition-colors">Cerrar</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    requestAnimationFrame(() => {
        document.getElementById('customModal').style.opacity = '1';
        document.getElementById('customModal').querySelector('.modal-content').style.transform = 'translateY(0) scale(1)';
    });

    document.getElementById('modalCloseBtn').onclick = () => {
        const modal = document.getElementById('customModal');
        modal.style.opacity = '0';
        modal.querySelector('.modal-content').style.transform = 'translateY(-10px) scale(0.98)';
        setTimeout(() => modal.remove(), 300);
    };
};

const getStatusBadge = (status) => {
    const styles = {
        'Completada': 'bg-green-100 text-green-800',
        'En Progreso': 'bg-yellow-100 text-yellow-800',
        'Pendiente': 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-slate-100 text-slate-800';
};

// --- RENDER FUNCTIONS ---
const renderPhases = () => {
    const container = document.getElementById('phases-container');
    container.innerHTML = state.phases.map(phase => `
        <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-xl font-bold">${phase.name}</h3>
            <p class="text-slate-500 mt-1 mb-4">${phase.description}</p>
            <div class="space-y-3">
                ${phase.tasks.map(task => `
                    <div class="task-card border border-slate-200 p-4 rounded-md flex justify-between items-center">
                        <div>
                            <p class="font-semibold">${task.title}</p>
                            <span class="text-xs font-medium px-2 py-0.5 rounded-full ${getStatusBadge(task.status)}">${task.status}</span>
                        </div>
                        <div class="flex space-x-2">
                            <select data-task-id="${task.id}" class="task-status-select text-xs border-slate-300 rounded-md py-1">
                                <option value="Pendiente" ${task.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                                <option value="En Progreso" ${task.status === 'En Progreso' ? 'selected' : ''}>En Progreso</option>
                                <option value="Completada" ${task.status === 'Completada' ? 'selected' : ''}>Completada</option>
                            </select>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
};

const renderDashboard = () => {
    const allTasks = state.phases.flatMap(p => p.tasks);
    const completedTasks = allTasks.filter(t => t.status === 'Completada').length;
    const pendingTasks = allTasks.length - completedTasks;

    const chartCtx = document.getElementById('progressChart').getContext('2d');
    if (state.progressChartInstance) {
        state.progressChartInstance.destroy();
    }
    state.progressChartInstance = new Chart(chartCtx, {
        type: 'doughnut',
        data: {
            labels: ['Completadas', 'Pendientes'],
            datasets: [{
                data: [completedTasks, pendingTasks],
                backgroundColor: ['#10b981', '#f87171'],
                borderColor: ['#ffffff'],
                borderWidth: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });

    const upcomingTasksContainer = document.getElementById('upcoming-tasks-list');
    const upcomingTasks = allTasks.filter(t => t.status !== 'Completada').slice(0, 5);
    if (upcomingTasks.length > 0) {
        upcomingTasksContainer.innerHTML = upcomingTasks.map(task => `
            <div class="bg-slate-100 p-3 rounded-md">
                <p class="font-semibold text-sm">${task.title}</p>
                <span class="text-xs font-medium px-2 py-0.5 rounded-full ${getStatusBadge(task.status)}">${task.status}</span>
            </div>
        `).join('');
    } else {
        upcomingTasksContainer.innerHTML = `<p class="text-slate-500 text-sm">¡Todas las tareas completadas! ¡Misión cumplida!</p>`;
    }

    // This part is for the User ID display
    const userIdDisplay = document.getElementById('user-id-display');
    if (userIdDisplay) {
        userIdDisplay.textContent = `ID de Usuario: ${currentUserId || 'No autenticado'}`;
    }
};

const renderGallery = () => {
    const container = document.getElementById('gallery-container');
    if (state.gallery.length === 0) {
        container.innerHTML = `<p class="text-slate-500 col-span-full text-center">Tu galería de ideas está vacía. ¡Es hora de generar algo de contenido!</p>`;
        return;
    }
    container.innerHTML = state.gallery.map(item => `
        <div class="bg-white p-4 rounded-lg shadow task-card flex flex-col justify-between">
            <div>
                <p class="text-xs font-semibold text-violet-600 uppercase">${item.type}</p>
                <p class="mt-2 font-medium">${item.text}</p>
                ${item.imageUrl ? `<img src="${item.imageUrl}" alt="Imagen de meme generada" class="my-2 w-full h-auto rounded-md object-cover">` : ''}
                <p class="text-sm text-slate-500 mt-2"><em>Prompt de imagen: ${item.prompt}</em></p>
            </div>
            <button data-gallery-id="${item.id}" class="delete-gallery-item-btn text-xs text-red-500 hover:text-red-700 mt-4 text-right self-end">Eliminar 🗑️</button>
        </div>
    `).join('');
};

const renderGeneratorOutput = (ideas) => {
    const container = document.getElementById('generator-output');
    container.innerHTML = ideas.map((idea, index) => `
        <div class="bg-white p-4 rounded-lg shadow mb-4 w-full">
            <p class="font-semibold">${idea.text}</p>
            ${idea.imageUrl ? `<img src="${idea.imageUrl}" alt="Imagen generada" class="my-2 w-full h-auto rounded-md object-cover">` : ''}
            <p class="text-sm text-slate-500 mt-1"><em>Prompt de imagen: ${idea.prompt}</em></p>
            <button data-idea-index="${index}" class="save-idea-btn mt-3 w-full text-sm bg-violet-100 text-violet-800 font-bold py-1 px-3 rounded-md hover:bg-violet-200 transition-colors">Guardar Idea</button>
        </div>
    `).join('');
};

// --- FIREBASE & DATA MANAGEMENT ---
const savePhasesToFirestore = async () => {
    if (!currentUserId) return;
    try {
        await setDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/campaigns`, 'phases'), { data: JSON.parse(JSON.stringify(state.phases)) });
    } catch (e) {
        console.error("Error saving phases to Firestore: ", e);
    }
};

const saveGalleryToFirestore = async () => {
    if (!currentUserId) return;
    try {
        await setDoc(doc(db, `artifacts/${appId}/users/${currentUserId}/campaigns`, 'gallery'), { data: JSON.parse(JSON.stringify(state.gallery)) });
    } catch (e) {
        console.error("Error saving gallery to Firestore: ", e);
    }
};

const setupFirestoreListeners = () => {
    if (!currentUserId) {
        state.phases = [];
        state.gallery = [];
        renderPhases();
        renderGallery();
        renderDashboard();
        return;
    }

    onSnapshot(doc(db, `artifacts/${appId}/users/${currentUserId}/campaigns`, 'phases'), (docSnapshot) => {
        if (docSnapshot.exists()) {
            state.phases = docSnapshot.data().data;
            if (state.activeTab === 'phases') renderPhases();
            if (state.activeTab === 'dashboard') renderDashboard();
        } else {
            state.phases = [
                { id: 1, name: 'Fase 1: El Gran P.A.S.O. Inicial', description: 'Introducir a P.A.S.O., generar intriga y comenzar a sembrar la parodia.', tasks: [ { id: 1, title: 'Crear perfiles RRSS de P.A.S.O. (anónimo)', status: 'Pendiente' }, { id: 2, title: 'Diseñar logo y eslogan amable de P.A.S.O.', status: 'Pendiente' }, { id: 3, title: 'Publicar "El Expediente de Quejas del Buen Conformista"', status: 'Pendiente' }, ] },
                { id: 2, name: 'Fase 2: El P.A.S.O. al Frente (o hacia el Sofá)', description: 'Intensificar la parodia, aumentar la identificación y generar debate.', tasks: [ { id: 4, title: 'Publicar "Los Días Extra por Paciencia Extrema"', status: 'Pendiente' }, { id: 5, title: 'Lanzar encuesta "¿Eres un \'PASO-Conformista\'?"', status: 'Pendiente' }, { id: 6, title: 'Crear vídeo corto "P.O.R.H. ¡Optimiza tu inacción!"', status: 'Pendiente' }, ] },
                { id: 3, name: 'Fase 3: El Último P.A.S.O.', description: 'La gran revelación y el giro hacia el sindicato real.', tasks: [ { id: 7, title: 'Preparar mensaje final de "despertar"', status: 'Pendiente' }, { id: 8, title: 'Diseñar micrositio con propuestas REALES del sindicato', status: 'Pendiente' }, ] }
            ];
            savePhasesToFirestore();
        }
    }, (error) => {
        console.error("Error fetching phases:", error);
    });

    onSnapshot(doc(db, `artifacts/${appId}/users/${currentUserId}/campaigns`, 'gallery'), (docSnapshot) => {
        if (docSnapshot.exists()) {
            state.gallery = docSnapshot.data().data;
            if (state.activeTab === 'gallery') renderGallery();
        } else {
            state.gallery = [];
            saveGalleryToFirestore();
        }
    }, (error) => {
        console.error("Error fetching gallery:", error);
    });
};

// --- EVENT HANDLERS & LOGIC ---
const switchTab = (tabId) => {
    state.activeTab = tabId;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${tabId}-section`).classList.remove('hidden');

    document.querySelectorAll('.nav-tab').forEach(el => {
        el.classList.remove('tab-active');
        if (el.dataset.tab === tabId) {
            el.classList.add('tab-active');
        }
    });
    
    if (tabId === 'dashboard') renderDashboard();
    if (tabId === 'phases') renderPhases();
    if (tabId === 'gallery') renderGallery();
};

document.addEventListener('click', async (e) => {
    if (!currentUserId) {
        showModal('La aplicación se está inicializando. Por favor, espera un momento.', 'Cargando');
        return;
    }

    if (e.target.closest('.nav-tab')) {
        switchTab(e.target.closest('.nav-tab').dataset.tab);
    }
    if (e.target.matches('.save-idea-btn')) {
        const ideaIndex = parseInt(e.target.dataset.ideaIndex);
        const problemInput = document.getElementById('problem-input').value;
        const contentTypeSelect = document.getElementById('content-type-select').value;
        
        const outputContainer = document.getElementById('generator-output');
        const currentIdeas = JSON.parse(outputContainer.dataset.generatedIdeas || '[]');
        
        if (ideaIndex < currentIdeas.length) {
            const ideaToSave = currentIdeas[ideaIndex];
            
            state.gallery.push({
                id: Date.now(),
                problem: problemInput,
                type: contentTypeSelect,
                text: ideaToSave.text,
                imageUrl: ideaToSave.imageUrl,
                prompt: ideaToSave.prompt
            });
            await saveGalleryToFirestore();
            
            outputContainer.innerHTML = `<p class="text-green-600 font-semibold text-center">¡Idea guardada en la Galería!</p>`;
            setTimeout(() => {
                 outputContainer.innerHTML = `<p class="text-slate-500 text-center">Las ideas generadas aparecerán aquí...</p>`;
            }, 2000);
        } else {
            showModal('Error al guardar la idea. Por favor, intenta generar nuevas ideas.', 'Error');
        }
    }
    if (e.target.matches('.delete-gallery-item-btn')) {
        const galleryId = parseInt(e.target.dataset.galleryId);
        state.gallery = state.gallery.filter(item => item.id !== galleryId);
        await saveGalleryToFirestore();
        renderGallery();
    }
});

document.addEventListener('change', async (e) => {
    if (!currentUserId) {
        showModal('La aplicación se está inicializando. Por favor, espera un momento.', 'Cargando');
        return;
    }
    if(e.target.matches('.task-status-select')) {
        const taskId = parseInt(e.target.dataset.taskId);
        const newStatus = e.target.value;
        state.phases = state.phases.map(phase => {
            const task = phase.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = newStatus;
            }
            return phase;
        });
        await savePhasesToFirestore();
        renderPhases();
        if (state.activeTab === 'dashboard') {
            renderDashboard();
        }
    }
});

document.getElementById('generator-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) {
        showModal('La aplicación se está inicializando. Por favor, espera un momento.', 'Cargando');
        return;
    }

    const problem = document.getElementById('problem-input').value;
    const type = document.getElementById('content-type-select').value;
    if (!problem.trim()) {
        showModal('Por favor, describe un problema para parodiar.', 'Campo Vacío');
        return;
    }
    
    const outputContainer = document.getElementById('generator-output');
    outputContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
            <p class="mt-4 text-slate-700">Generando ideas y la imagen...</p>
        </div>
    `;

    try {
        const ideas = await generateContentIdeas(problem, type);
        outputContainer.dataset.generatedIdeas = JSON.stringify(ideas); // Store generated ideas
        renderGeneratorOutput(ideas);
    } catch (error) {
        console.error("Error generating content:", error);
        outputContainer.innerHTML = `<p class="text-red-500 text-center">Error al generar contenido. Inténtalo de nuevo. ${error.message}</p>`;
        showModal(`Hubo un error al generar el contenido o la imagen: ${error.message}`, 'Error de Generación');
    }
});

// --- GEMINI API FUNCTIONS ---
const callGeminiApi = async (model, payload, retries = 3, delay = 1000) => {
    const apiKey = "AIzaSyAPnT1BOy9fEXfJn2g2bgUDvad3PetxEZg"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 429 && i < retries - 1) { 
                    await new Promise(res => setTimeout(res, delay));
                    delay *= 2; 
                    continue;
                }
                throw new Error(`API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
            }
            return await response.json();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }
};

const callImagenApi = async (model, prompt, retries = 3, delay = 1000) => {
    const apiKey = "AIzaSyAPnT1BOy9fEXfJn2g2bgUDvad3PetxEZg";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
    const payload = { instances: { prompt: prompt }, parameters: { "sampleCount": 1 } };

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 429 && i < retries - 1) {
                    await new Promise(res => setTimeout(res, delay));
                    delay *= 2;
                    continue;
                }
                throw new Error(`Imagen API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
            }
            const result = await response.json();
            if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
                return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
            } else {
                throw new Error("No image data found in Imagen API response.");
            }
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }
};

const generateContentIdeas = async (problem, type) => {
    const textPrompt = `Genera una idea de contenido irónico/parodia para redes sociales (meme, propuesta absurda o pregunta de encuesta) sobre el problema "${problem}" en el sector sanitario, desde la perspectiva de P.A.S.O. (Plataforma de Acomodación Sindical Orgánica). El tipo de contenido debe ser un "${type}". También, genera un prompt muy descriptivo y creativo para una imagen que acompañe esta idea, en español, reflejando el tono de P.A.S.O.

    Formato JSON esperado:
    [
      {
        "text": "Texto de la publicación o propuesta irónica.",
        "image_prompt": "Prompt descriptivo para generar la imagen."
      }
    ]`;

    const textPayload = {
        contents: [{ parts: [{ text: textPrompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        "text": { "type": "STRING" },
                        "image_prompt": { "type": "STRING" }
                    },
                    "propertyOrdering": ["text", "image_prompt"]
                }
            }
        }
    };

    const textResponse = await callGeminiApi('gemini-2.5-flash-preview-05-20', textPayload);
    const parsedText = JSON.parse(textResponse.candidates[0].content.parts[0].text);

    const results = [];
    for (const item of parsedText) {
        let imageUrl = '';
        try {
            imageUrl = await callImagenApi('imagen-3.0-generate-002', item.image_prompt);
        } catch (imgError) {
            console.error("Error generating image for prompt:", item.image_prompt, imgError);
            imageUrl = 'https://placehold.co/300x200/cccccc/333333?text=Error+imagen'; // Placeholder on error
        }
        results.push({
            text: item.text,
            prompt: item.image_prompt,
            imageUrl: imageUrl
        });
    }
    return results;
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
        } else {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    const anonUser = await signInAnonymously(auth);
                    currentUserId = anonUser.user.uid;
                }
            } catch (error) {
                console.error("Firebase auth error:", error);
                currentUserId = crypto.randomUUID(); // Fallback if auth fails
                showModal(`Error de autenticación: ${error.message}. Se usará un ID anónimo temporal.`, 'Error de Autenticación');
            }
        }
        setupFirestoreListeners();
        switchTab(state.activeTab); // Render initial tab after auth
    });
});

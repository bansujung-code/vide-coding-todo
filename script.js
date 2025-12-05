// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    onValue, 
    remove, 
    update,
    query,
    orderByChild
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD2kWGBjVoLDEGQ5e6GnUoJKfwUTDHI_yA",
    authDomain: "sujung-todo-be.firebaseapp.com",
    projectId: "sujung-todo-be",
    storageBucket: "sujung-todo-be.firebasestorage.app",
    messagingSenderId: "604912810144",
    appId: "1:604912810144:web:75ea36372a3f38f461f1c5",
    measurementId: "G-5LSQFF1VPP",
    databaseURL: "https://sujung-todo-be-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// 할일 데이터 저장소
let todos = [];
let folders = [];
let currentFilter = 'all';
let currentView = 'today';
let currentFolderId = null;

// DOM 요소
const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const todoCount = document.getElementById('todoCount');
const filterBtns = document.querySelectorAll('.filter-btn');
const foldersList = document.getElementById('foldersList');
const folderSelect = document.getElementById('folderSelect');
const newFolderInputWrapper = document.getElementById('newFolderInputWrapper');
const newFolderInput = document.getElementById('newFolderInput');
const createFolderFromTodoBtn = document.getElementById('createFolderFromTodoBtn');
const navSectionHeader = document.getElementById('navSectionHeader');
const addFolderBtn = document.getElementById('addFolderBtn');
const folderCreateInputWrapper = document.getElementById('folderCreateInputWrapper');
const folderCreateInput = document.getElementById('folderCreateInput');
const createFolderBtn = document.getElementById('createFolderBtn');
const folderModal = document.getElementById('folderModal');
const folderNameInput = document.getElementById('folderNameInput');
const cancelFolderBtn = document.getElementById('cancelFolderBtn');
const closeFolderModal = document.getElementById('closeFolderModal');
const currentViewTitle = document.getElementById('currentViewTitle');

// 폴더 불러오기 (Firebase Realtime Database)
function loadFolders() {
    const foldersRef = ref(db, 'folders');
    
    onValue(foldersRef, (snapshot) => {
        folders = [];
        const data = snapshot.val();
        
        if (data) {
            Object.keys(data).forEach((key) => {
                folders.push({
                    id: key,
                    ...data[key]
                });
            });
            
            // 생성 시간 기준으로 정렬
            folders.sort((a, b) => {
                const timeA = new Date(a.createdAt || 0).getTime();
                const timeB = new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });
        }
        
        renderFolders();
        updateFolderSelect();
    }, (error) => {
        console.error('폴더를 불러오는 중 오류 발생:', error);
    });
}

// 폴더 목록 렌더링
function renderFolders() {
    if (folders.length === 0) {
        foldersList.innerHTML = '<div style="padding: 10px 20px; color: #fff; font-size: 13px;">폴더가 없습니다</div>';
        return;
    }
    
    foldersList.innerHTML = folders.map(folder => `
        <div class="folder-item" data-folder-id="${folder.id}">
            <div class="folder-item-content" onclick="selectFolder('${folder.id}')">
                <span class="folder-name">${escapeHtml(folder.name)}</span>
            </div>
            <button class="folder-more-btn" onclick="event.stopPropagation(); toggleFolderPopover('${folder.id}')" title="더보기">
                <span>⋯</span>
            </button>
            <div class="folder-popover" id="popover-${folder.id}">
                <button class="popover-item" onclick="editFolder('${folder.id}')">
                    <span class="popover-icon">✏️</span>
                    <span>수정</span>
                </button>
                <button class="popover-item popover-item-danger" onclick="deleteFolder('${folder.id}')">
                    <span class="popover-icon">🗑️</span>
                    <span>삭제</span>
                </button>
            </div>
        </div>
    `).join('');
    
    // 현재 선택된 폴더 하이라이트
    if (currentFolderId) {
        const folderItem = foldersList.querySelector(`[data-folder-id="${currentFolderId}"]`);
        if (folderItem) {
            folderItem.classList.add('active');
        }
    }
}

// nav-section-header에서 폴더 생성
async function createFolderFromHeader() {
    const input = document.getElementById('folderCreateInput');
    if (!input) return;
    
    const name = input.value.trim();
    if (name === '') {
        alert('폴더 이름을 입력해주세요!');
        return;
    }
    
    // 중복 확인
    if (folders.some(f => f.name === name)) {
        alert('이미 존재하는 폴더 이름입니다.');
        return;
    }
    
    try {
        const newFolder = {
            name: name,
            createdAt: new Date().toISOString()
        };
        
        const foldersRef = ref(db, 'folders');
        const newFolderRef = push(foldersRef);
        await set(newFolderRef, newFolder);
        
        console.log('폴더가 생성되었습니다. ID:', newFolderRef.key);
        
        // 입력 필드 초기화 및 숨김
        input.value = '';
        document.getElementById('folderCreateInputWrapper').style.display = 'none';
    } catch (error) {
        console.error('폴더 생성 중 오류 발생:', error);
        alert('폴더를 생성하는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 폴더 선택 드롭다운 업데이트
function updateFolderSelect() {
    folderSelect.innerHTML = '<option value="" disabled selected>폴더 선택</option><option value="__new__">+ 새 폴더 생성</option>';
    folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = folder.name;
        folderSelect.appendChild(option);
    });
}

// 폴더 생성
async function createFolder() {
    const name = folderNameInput.value.trim();
    if (name === '') {
        alert('폴더 이름을 입력해주세요!');
        return;
    }
    
    // 중복 확인
    if (folders.some(f => f.name === name)) {
        alert('이미 존재하는 폴더 이름입니다.');
        return;
    }
    
    try {
        const newFolder = {
            name: name,
            createdAt: new Date().toISOString()
        };
        
        const foldersRef = ref(db, 'folders');
        const newFolderRef = push(foldersRef);
        await set(newFolderRef, newFolder);
        
        console.log('폴더가 생성되었습니다. ID:', newFolderRef.key);
        
        // 모달 닫기
        closeFolderModalFunc();
    } catch (error) {
        console.error('폴더 생성 중 오류 발생:', error);
        alert('폴더를 생성하는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 폴더 popover 토글
function toggleFolderPopover(folderId) {
    // 다른 popover 닫기
    document.querySelectorAll('.folder-popover').forEach(popover => {
        if (popover.id !== `popover-${folderId}`) {
            popover.classList.remove('show');
        }
    });
    
    // 현재 popover 토글
    const popover = document.getElementById(`popover-${folderId}`);
    if (popover) {
        popover.classList.toggle('show');
    }
}

// 폴더 수정
function editFolder(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    // popover 닫기
    const popover = document.getElementById(`popover-${folderId}`);
    if (popover) {
        popover.classList.remove('show');
    }
    
    // 폴더 이름 입력 받기
    const newName = prompt('폴더 이름을 입력하세요:', folder.name);
    if (!newName || newName.trim() === '') {
        return;
    }
    
    const trimmedName = newName.trim();
    
    // 중복 확인
    if (folders.some(f => f.id !== folderId && f.name === trimmedName)) {
        alert('이미 존재하는 폴더 이름입니다.');
        return;
    }
    
    // Firebase에서 폴더 수정
    updateFolder(folderId, trimmedName);
}

// Firebase에서 폴더 수정
async function updateFolder(folderId, newName) {
    try {
        const folderRef = ref(db, `folders/${folderId}`);
        await update(folderRef, {
            name: newName,
            updatedAt: new Date().toISOString()
        });
        console.log('폴더가 수정되었습니다. ID:', folderId);
    } catch (error) {
        console.error('폴더 수정 중 오류 발생:', error);
        alert('폴더를 수정하는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 폴더 삭제
async function deleteFolder(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    // popover 닫기
    const popover = document.getElementById(`popover-${folderId}`);
    if (popover) {
        popover.classList.remove('show');
    }
    
    // 해당 폴더의 할일 개수 확인
    const folderTodos = todos.filter(todo => todo.folderId === folderId);
    const todoCount = folderTodos.length;
    
    let confirmMessage = `"${folder.name}" 폴더를 삭제하시겠습니까?`;
    if (todoCount > 0) {
        confirmMessage += `\n이 폴더에 속한 할일 ${todoCount}개도 함께 삭제됩니다.`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        // 폴더 삭제
        const folderRef = ref(db, `folders/${folderId}`);
        await remove(folderRef);
        
        // 해당 폴더의 할일도 삭제
        if (todoCount > 0) {
            const deletePromises = folderTodos.map(todo => {
                const todoRef = ref(db, `todos/${todo.id}`);
                return remove(todoRef);
            });
            await Promise.all(deletePromises);
        }
        
        console.log('폴더가 삭제되었습니다. ID:', folderId);
        
        // 현재 선택된 폴더가 삭제된 폴더라면 '오늘' 뷰로 전환
        if (currentFolderId === folderId) {
            selectView('today');
        }
    } catch (error) {
        console.error('폴더 삭제 중 오류 발생:', error);
        alert('폴더를 삭제하는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 폴더 선택
function selectFolder(folderId) {
    // popover가 열려있으면 폴더 선택하지 않음
    const popover = document.getElementById(`popover-${folderId}`);
    if (popover && popover.classList.contains('show')) {
        return;
    }
    
    currentFolderId = folderId;
    currentView = 'folder';
    
    // 네비게이션 업데이트
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const folderItem = document.querySelector(`[data-folder-id="${folderId}"]`);
    if (folderItem) {
        folderItem.classList.add('active');
    }
    
    // 제목 업데이트
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
        currentViewTitle.textContent = folder.name;
    }
    
    // 폴더 선택 드롭다운도 자동으로 해당 폴더로 설정
    if (folderSelect) {
        folderSelect.value = folderId;
    }
    
    renderTodos();
}

// 뷰 선택 (오늘)
function selectView(view) {
    currentView = view;
    currentFolderId = null;
    
    // 모든 드롭다운 닫기
    document.querySelectorAll('.folder-dropdown').forEach(dropdown => {
        dropdown.classList.remove('show');
    });
    
    // 네비게이션 업데이트
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`[data-view="${view}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // 제목 업데이트
    if (view === 'today') {
        currentViewTitle.textContent = '오늘';
    }
    
    // 폴더 선택 드롭다운 초기화
    if (folderSelect) {
        folderSelect.value = '';
        folderSelect.selectedIndex = 0;
    }
    
    renderTodos();
}

// 모달 닫기
function closeFolderModalFunc() {
    folderModal.classList.remove('show');
    folderNameInput.value = '';
}

// Realtime Database에서 할일 불러오기 (실시간 업데이트)
function loadTodos() {
    const todosRef = ref(db, 'todos');
    
    // 실시간으로 데이터 변경 감지
    onValue(todosRef, (snapshot) => {
        todos = [];
        const data = snapshot.val();
        
        if (data) {
            // 객체를 배열로 변환
            Object.keys(data).forEach((key) => {
                todos.push({
                    id: key,
                    ...data[key]
                });
            });
            
            // 생성 시간 기준으로 정렬 (최신순)
            todos.sort((a, b) => {
                const timeA = new Date(a.createdAt || 0).getTime();
                const timeB = new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });
        }
        
        renderTodos();
    }, (error) => {
        console.error('할일을 불러오는 중 오류 발생:', error);
        alert('할일을 불러오는 중 오류가 발생했습니다: ' + error.message);
    });
}

// 할일 추가 (Firebase Realtime Database 사용)
async function addTodo() {
    const text = todoInput.value.trim();
    if (text === '') {
        alert('할일을 입력해주세요!');
        return;
    }
    
    let selectedFolderId = folderSelect.value;
    
    // '오늘' 뷰에서 폴더 선택이 필수
    if (currentView === 'today') {
        if (!selectedFolderId || selectedFolderId === '' || selectedFolderId === '__new__') {
            // 새 폴더 생성이 선택되지 않은 경우
            if (!selectedFolderId || selectedFolderId === '') {
                alert('폴더를 선택해주세요!');
                folderSelect.focus();
                return;
            }
        }
    }
    
    // 폴더 선택 드롭다운에 값이 없고, 현재 폴더 뷰가 활성화되어 있으면 자동으로 현재 폴더에 할당
    if ((!selectedFolderId || selectedFolderId === '') && currentView === 'folder' && currentFolderId) {
        selectedFolderId = currentFolderId;
    }
    
    // 새 폴더 생성 옵션이 선택된 경우
    if (selectedFolderId === '__new__') {
        const newFolderName = newFolderInput.value.trim();
        if (newFolderName === '') {
            alert('폴더 이름을 입력해주세요!');
            newFolderInput.focus();
            return;
        }
        
        // 중복 확인
        if (folders.some(f => f.name === newFolderName)) {
            alert('이미 존재하는 폴더 이름입니다.');
            newFolderInput.focus();
            return;
        }
        
        // 폴더 생성
        try {
            const newFolder = {
                name: newFolderName,
                createdAt: new Date().toISOString()
            };
            
            const foldersRef = ref(db, 'folders');
            const newFolderRef = push(foldersRef);
            await set(newFolderRef, newFolder);
            
            selectedFolderId = newFolderRef.key;
            console.log('폴더가 생성되었습니다. ID:', selectedFolderId);
        } catch (error) {
            console.error('폴더 생성 중 오류 발생:', error);
            alert('폴더를 생성하는 중 오류가 발생했습니다: ' + error.message);
            return;
        }
    }
    
    // 입력 필드 비활성화 (중복 추가 방지)
    addBtn.disabled = true;
    addBtn.textContent = '추가 중...';
    
    try {
        // Realtime Database에 새 할일 추가
        // 폴더 ID가 유효한지 확인 (null이거나 '__new__'가 아니어야 함)
        const finalFolderId = selectedFolderId && selectedFolderId !== '__new__' ? selectedFolderId : null;
        
        // '오늘' 뷰에서는 폴더가 필수이므로 null이면 안 됨
        if (currentView === 'today' && !finalFolderId) {
            alert('폴더를 선택해주세요!');
            folderSelect.focus();
            addBtn.disabled = false;
            addBtn.textContent = '작업 추가';
            return;
        }
        
        const newTodo = {
            text: text,
            completed: false,
            folderId: finalFolderId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Realtime Database의 'todos' 경로에 새 항목 추가
        const todosRef = ref(db, 'todos');
        const newTodoRef = push(todosRef);
        await set(newTodoRef, newTodo);
        
        console.log('할일이 추가되었습니다. ID:', newTodoRef.key);
        
        // 입력 필드 초기화
        todoInput.value = '';
        
        // 현재 폴더 뷰가 활성화되어 있으면 폴더 선택 드롭다운을 현재 폴더로 유지
        if (currentView === 'folder' && currentFolderId) {
            folderSelect.value = currentFolderId;
        } else if (currentView === 'today') {
            // '오늘' 뷰에서는 폴더 선택을 유지 (필수이므로)
            // 폴더 선택은 그대로 유지
        } else {
            folderSelect.value = '';
            folderSelect.selectedIndex = 0; // 첫 번째 옵션(폴더 선택)으로 리셋
        }
        
        newFolderInputWrapper.style.display = 'none';
        newFolderInput.value = '';
        todoInput.focus();
        
        // 버튼 비활성화 ('오늘' 뷰에서는 폴더 선택이 필요하므로)
        if (currentView === 'today') {
            const hasFolder = folderSelect.value && folderSelect.value !== '';
            addBtn.disabled = !hasFolder;
        } else {
            addBtn.disabled = true;
        }
    } catch (error) {
        console.error('할일 추가 중 오류 발생:', error);
        alert('할일을 추가하는 중 오류가 발생했습니다: ' + error.message);
    } finally {
        // 버튼 상태 복원
        addBtn.disabled = false;
        addBtn.textContent = '추가';
    }
}

// 할일 삭제 (Firebase Realtime Database 사용)
async function deleteTodo(id) {
    if (!confirm('정말 삭제하시겠습니까?')) {
        return;
    }
    
    // 삭제할 항목 찾기
    const todo = todos.find(t => t.id === id);
    if (!todo) {
        alert('삭제할 할일을 찾을 수 없습니다.');
        return;
    }
    
    // 삭제 버튼 비활성화 (중복 삭제 방지)
    const deleteBtn = document.querySelector(`[data-id="${id}"] .delete-btn`);
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = '삭제 중...';
    }
    
    try {
        // Firebase Realtime Database에서 할일 삭제
        const todoRef = ref(db, `todos/${id}`);
        await remove(todoRef);
        console.log('할일이 삭제되었습니다. ID:', id);
    } catch (error) {
        console.error('할일 삭제 중 오류 발생:', error);
        alert('할일을 삭제하는 중 오류가 발생했습니다: ' + error.message);
        
        // 버튼 상태 복원
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '삭제';
        }
    }
}

// 할일 완료 상태 토글
async function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    
    try {
        const todoRef = ref(db, `todos/${id}`);
        await update(todoRef, {
            completed: !todo.completed,
            updatedAt: new Date().toISOString()
        });
        console.log('할일 상태가 변경되었습니다. ID:', id);
    } catch (error) {
        console.error('할일 상태 변경 중 오류 발생:', error);
        alert('할일 상태를 변경하는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 할일 수정 모드 진입
function editTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) {
        alert('수정할 할일을 찾을 수 없습니다.');
        return;
    }
    
    const todoItem = document.querySelector(`[data-id="${id}"]`);
    if (!todoItem) {
        alert('할일 항목을 찾을 수 없습니다.');
        return;
    }
    
    const todoText = todoItem.querySelector('.todo-text');
    const todoActions = todoItem.querySelector('.todo-actions');
    
    if (!todoText || !todoActions) {
        alert('할일 항목의 구조를 찾을 수 없습니다.');
        return;
    }
    
    // 입력 필드로 변경
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'todo-text editing';
    input.value = todo.text;
    
    // 버튼 변경
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.textContent = '저장';
    saveBtn.onclick = () => saveEdit(id, input.value);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn';
    cancelBtn.textContent = '취소';
    cancelBtn.onclick = () => cancelEdit(id);
    
    // 기존 요소 교체
    todoText.replaceWith(input);
    todoActions.innerHTML = '';
    todoActions.appendChild(saveBtn);
    todoActions.appendChild(cancelBtn);
    
    input.focus();
    input.select();
    
    // Enter 키로 저장, Escape 키로 취소
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveEdit(id, input.value);
        } else if (e.key === 'Escape') {
            cancelEdit(id);
        }
    });
}

// 할일 수정 저장 (Firebase Realtime Database 사용)
async function saveEdit(id, newText) {
    const text = newText.trim();
    if (text === '') {
        alert('할일을 입력해주세요!');
        return;
    }
    
    // 수정할 항목 찾기
    const todo = todos.find(t => t.id === id);
    if (!todo) {
        alert('수정할 할일을 찾을 수 없습니다.');
        return;
    }
    
    // 같은 내용이면 수정하지 않음
    if (todo.text === text) {
        cancelEdit(id);
        return;
    }
    
    // 저장 버튼 비활성화 (중복 저장 방지)
    const saveBtn = document.querySelector(`[data-id="${id}"] .save-btn`);
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '저장 중...';
    }
    
    try {
        // Firebase Realtime Database에서 할일 수정
        const todoRef = ref(db, `todos/${id}`);
        await update(todoRef, {
            text: text,
            updatedAt: new Date().toISOString()
        });
        console.log('할일이 수정되었습니다. ID:', id, '새 내용:', text);
    } catch (error) {
        console.error('할일 수정 중 오류 발생:', error);
        alert('할일을 수정하는 중 오류가 발생했습니다: ' + error.message);
        
        // 버튼 상태 복원
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '저장';
        }
    }
}

// 할일 수정 취소
function cancelEdit(id) {
    renderTodos();
}

// 필터 변경
function setFilter(filter) {
    currentFilter = filter;
    
    // 필터 버튼 활성화 상태 업데이트
    filterBtns.forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    renderTodos();
}

// 필터링된 할일 목록 가져오기
function getFilteredTodos() {
    let filtered = todos;
    
    // 뷰별 필터링
    if (currentView === 'today') {
        // 오늘 날짜의 할일만 표시 (간단히 모든 할일 표시)
        filtered = todos;
    } else if (currentView === 'folder' && currentFolderId) {
        // 선택된 폴더의 할일만 표시
        filtered = todos.filter(todo => todo.folderId === currentFolderId);
    }
    
    // 상태별 필터링
    switch (currentFilter) {
        case 'active':
            return filtered.filter(todo => !todo.completed);
        case 'completed':
            return filtered.filter(todo => todo.completed);
        default:
            return filtered;
    }
}

// 할일 목록 렌더링
function renderTodos() {
    const filteredTodos = getFilteredTodos();
    
    if (filteredTodos.length === 0) {
        todoList.innerHTML = '<li class="empty-state"><div class="empty-state-text">할일이 없습니다</div></li>';
    } else {
        todoList.innerHTML = filteredTodos.map(todo => {
            const folder = todo.folderId ? folders.find(f => f.id === todo.folderId) : null;
            const date = todo.createdAt ? formatDate(todo.createdAt) : '';
            return `
            <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
                <input 
                    type="checkbox" 
                    class="todo-checkbox" 
                    ${todo.completed ? 'checked' : ''}
                    onchange="toggleTodo('${todo.id}')"
                >
                <div class="todo-content">
                    <span class="todo-text">${escapeHtml(todo.text)}</span>
                    <div class="todo-meta">
                        ${date ? `<div class="todo-date">${date}</div>` : '<div></div>'}
                        ${folder ? `<span class="todo-folder">${escapeHtml(folder.name)}</span>` : ''}
                    </div>
                </div>
                <div class="todo-actions">
                    <button class="edit-btn" onclick="editTodo('${todo.id}')" title="수정"></button>
                    <button class="delete-btn" onclick="deleteTodo('${todo.id}')" title="삭제"></button>
                </div>
            </li>
        `;
        }).join('');
    }
    
    // 통계 업데이트
    const filteredCount = filteredTodos.length;
    const activeCount = filteredTodos.filter(t => !t.completed).length;
    const completedCount = filteredTodos.filter(t => t.completed).length;
    
    todoCount.textContent = `${filteredCount}개의 할일`;
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 날짜 포맷팅 (예: 7월 16일)
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    return `${month}월 ${day}일`;
}

// 이벤트 리스너
addBtn.addEventListener('click', addTodo);

todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && todoInput.value.trim().length > 0) {
        addTodo();
    }
});

// 입력 필드 변경 시 버튼 활성화/비활성화
todoInput.addEventListener('input', (e) => {
    const hasText = e.target.value.trim().length > 0;
    const hasFolder = folderSelect.value && folderSelect.value !== '';
    
    // '오늘' 뷰에서는 텍스트와 폴더 선택이 모두 필요
    if (currentView === 'today') {
        addBtn.disabled = !hasText || !hasFolder;
    } else {
        addBtn.disabled = !hasText;
    }
});

// 폴더 선택 변경 시 버튼 활성화/비활성화 ('오늘' 뷰에서만)
folderSelect.addEventListener('change', (e) => {
    if (currentView === 'today') {
        const hasText = todoInput.value.trim().length > 0;
        const hasFolder = e.target.value && e.target.value !== '';
        addBtn.disabled = !hasText || !hasFolder;
    }
});

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setFilter(btn.dataset.filter);
    });
});

// 폴더 선택 드롭다운 변경 이벤트
folderSelect.addEventListener('change', (e) => {
    if (e.target.value === '__new__') {
        // 새 폴더 생성 옵션이 선택되면 입력 필드 표시
        newFolderInputWrapper.style.display = 'flex';
        newFolderInput.focus();
    } else {
        // 다른 옵션이 선택되면 입력 필드 숨김
        newFolderInputWrapper.style.display = 'none';
        newFolderInput.value = '';
    }
});

// 새 폴더 입력 필드에서 Enter 키 처리
newFolderInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        // 폴더 생성 후 할일 추가는 하지 않음 (사용자가 직접 추가 버튼 클릭)
        e.preventDefault();
    }
});

// 폴더 생성 버튼 (할일 생성 섹션)
createFolderFromTodoBtn.addEventListener('click', async () => {
    const name = newFolderInput.value.trim();
    if (name === '') {
        alert('폴더 이름을 입력해주세요!');
        return;
    }
    
    // 중복 확인
    if (folders.some(f => f.name === name)) {
        alert('이미 존재하는 폴더 이름입니다.');
        return;
    }
    
    try {
        const newFolder = {
            name: name,
            createdAt: new Date().toISOString()
        };
        
        const foldersRef = ref(db, 'folders');
        const newFolderRef = push(foldersRef);
        await set(newFolderRef, newFolder);
        
        console.log('폴더가 생성되었습니다. ID:', newFolderRef.key);
        
        // 드롭다운에서 새로 생성된 폴더 선택
        folderSelect.value = newFolderRef.key;
        newFolderInputWrapper.style.display = 'none';
        newFolderInput.value = '';
    } catch (error) {
        console.error('폴더 생성 중 오류 발생:', error);
        alert('폴더를 생성하는 중 오류가 발생했습니다: ' + error.message);
    }
});

// nav-section-header 호버 시 + 아이콘 표시
if (navSectionHeader) {
    navSectionHeader.addEventListener('mouseenter', () => {
        if (addFolderBtn) {
            addFolderBtn.style.display = 'flex';
        }
    });
    
    navSectionHeader.addEventListener('mouseleave', () => {
        if (addFolderBtn && !folderCreateInputWrapper?.style.display || folderCreateInputWrapper?.style.display === 'none') {
            addFolderBtn.style.display = 'none';
        }
    });
}

// + 아이콘 클릭 시 폴더 생성 인풋 표시
if (addFolderBtn) {
    addFolderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (folderCreateInputWrapper) {
            folderCreateInputWrapper.style.display = 'flex';
            if (folderCreateInput) {
                folderCreateInput.focus();
            }
        }
    });
}

// nav-section-header에서 폴더 생성 버튼
if (createFolderBtn) {
    createFolderBtn.addEventListener('click', createFolderFromHeader);
}

// 폴더 생성 입력 필드에서 Enter 키 처리
if (folderCreateInput) {
    folderCreateInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createFolderFromHeader();
        } else if (e.key === 'Escape') {
            folderCreateInputWrapper.style.display = 'none';
            folderCreateInput.value = '';
            if (addFolderBtn) {
                addFolderBtn.style.display = 'none';
            }
        }
    });
    
    // 입력 필드에서 포커스가 벗어날 때 처리
    folderCreateInput.addEventListener('blur', () => {
        // 약간의 지연을 두어 버튼 클릭이 먼저 처리되도록
        setTimeout(() => {
            if (folderCreateInput.value.trim() === '') {
                folderCreateInputWrapper.style.display = 'none';
                if (addFolderBtn && !navSectionHeader.matches(':hover')) {
                    addFolderBtn.style.display = 'none';
                }
            }
        }, 200);
    });
}

// 폴더 관련 이벤트 (모달 - 기존 코드 유지)
if (folderModal && folderNameInput) {
    // 모달은 다른 곳에서 사용할 수 있으므로 유지
}

if (cancelFolderBtn) {
    cancelFolderBtn.addEventListener('click', closeFolderModalFunc);
}

if (closeFolderModal) {
    closeFolderModal.addEventListener('click', closeFolderModalFunc);
}

if (folderNameInput) {
    folderNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createFolder();
        } else if (e.key === 'Escape') {
            closeFolderModalFunc();
        }
    });
}

// 모달 배경 클릭 시 닫기
if (folderModal) {
    folderModal.addEventListener('click', (e) => {
        if (e.target === folderModal) {
            closeFolderModalFunc();
        }
    });
}

// 네비게이션 아이템 클릭
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (view) {
            selectView(view);
        }
    });
});

// 전역 함수로 등록 (HTML의 onclick 이벤트에서 사용하기 위해)
window.toggleTodo = toggleTodo;
window.editTodo = editTodo;
window.deleteTodo = deleteTodo;
window.selectFolder = selectFolder;
window.toggleFolderPopover = toggleFolderPopover;
window.editFolder = editFolder;
window.deleteFolder = deleteFolder;

// 외부 클릭 시 popover 닫기
document.addEventListener('click', (e) => {
    if (!e.target.closest('.folder-item') && !e.target.closest('.folder-popover')) {
        document.querySelectorAll('.folder-popover').forEach(popover => {
            popover.classList.remove('show');
        });
    }
});

// 테마 전환 기능
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');
    const savedTheme = localStorage.getItem('theme') || 'dark';
    
    // 저장된 테마 적용
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(themeIcon, savedTheme);
    
    // 테마 전환 버튼 클릭 이벤트
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(themeIcon, newTheme);
        });
    }
}

function updateThemeIcon(icon, theme) {
    if (!icon) return;
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// 모바일 메뉴 기능
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
    
    function openSidebar() {
        sidebar.classList.add('active');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        // 모바일 메뉴 버튼 숨기기
        if (mobileMenuBtn) {
            mobileMenuBtn.style.display = 'none';
        }
    }
    
    function closeSidebar() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
        // 모바일 메뉴 버튼 다시 보이기
        if (mobileMenuBtn && window.innerWidth <= 768) {
            mobileMenuBtn.style.display = 'flex';
        }
    }
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', openSidebar);
    }
    
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', closeSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    // 사이드바 내부 링크 클릭 시 모바일에서 사이드바 닫기
    const sidebarLinks = sidebar.querySelectorAll('.nav-item, .folder-item');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
    
    // 화면 크기 변경 시 사이드바 상태 조정
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeSidebar();
            // PC 사이즈에서는 모바일 메뉴 버튼 숨기기
            if (mobileMenuBtn) {
                mobileMenuBtn.style.display = 'none';
            }
        } else {
            // 모바일로 돌아왔을 때 사이드바가 닫혀있으면 메뉴 버튼 표시
            if (!sidebar.classList.contains('active') && mobileMenuBtn) {
                mobileMenuBtn.style.display = 'flex';
            }
        }
    });
}

// 로고 클릭 시 첫 화면으로 이동
function initLogoClick() {
    const logo = document.getElementById('logo');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    if (logo) {
        logo.addEventListener('click', () => {
            selectView('today');
            // 모바일에서 사이드바가 열려있으면 닫기
            if (window.innerWidth <= 768) {
                if (sidebar && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    if (sidebarOverlay) {
                        sidebarOverlay.classList.remove('active');
                    }
                    document.body.style.overflow = '';
                    // 모바일 메뉴 버튼 다시 보이기
                    if (mobileMenuBtn) {
                        mobileMenuBtn.style.display = 'flex';
                    }
                }
            }
        });
    }
}

// 초기 로드 시 화면 크기에 따라 모바일 메뉴 버튼 표시/숨김
function initMobileMenuButton() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        if (window.innerWidth > 768) {
            mobileMenuBtn.style.display = 'none';
        } else {
            mobileMenuBtn.style.display = 'flex';
        }
    }
}

// 초기화
initTheme();
initMobileMenu();
initLogoClick();
initMobileMenuButton();
loadFolders();
loadTodos();


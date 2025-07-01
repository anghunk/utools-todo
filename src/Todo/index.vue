<script setup>
import { ref, onMounted, computed, nextTick, onUnmounted, watch } from "vue";
import draggable from "vuedraggable";

// 生成随机ID
const generateId = () => {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
};

// 自动聚焦指令
const vFocus = {
  mounted: (el) => el.focus(),
};

// 自动调整高度指令
const vAutoHeight = {
  mounted: (el) => {
    adjustHeight(el);
    el.addEventListener("input", () => adjustHeight(el));
  },
  updated: (el) => {
    adjustHeight(el);
  },
};

// 调整textarea高度的函数
const adjustHeight = (el) => {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
};

// 云同步状态
const cloudSync = ref({
  enabled: false,
  syncing: false,
  completed: false,
  checked: false
});

// 检查云同步状态（保留功能但不显示）
const checkCloudSyncStatus = () => {
  try {
    if (window.services && window.services.checkCloudSyncState) {
      const state = window.services.checkCloudSyncState();
      cloudSync.value = {
        ...state,
        checked: true
      };
      // 如果正在同步，可以在控制台记录信息，但不在界面上显示
      console.log('云同步状态:', cloudSync.value);
    }
  } catch (err) {
    console.error('检查云同步状态失败:', err);
  }
};

// 定义待办项数据结构
const todos = ref([]);
const newTodo = ref("");
const editingTodo = ref(null); // 当前正在编辑的待办项
const editText = ref(""); // 编辑框的内容
const isDragging = ref(false); // 是否正在拖拽

// 未完成的待办列表
const uncompletedTodosArray = ref([]);

// 已完成的待办列表
const completedTodosArray = ref([]);

// 当前项目的顺序
const currentOrder = ref(0);

// 监视todos变化，更新拖拽数组
const updateDraggableArrays = () => {
  console.log("更新拖拽数组", todos.value);

  uncompletedTodosArray.value = [
    ...todos.value.filter((todo) => !todo.completed),
  ].sort((a, b) => (a.order || 0) - (b.order || 0));

  completedTodosArray.value = [
    ...todos.value.filter((todo) => todo.completed),
  ].sort((a, b) => (a.order || 0) - (b.order || 0));

  console.log("未完成", uncompletedTodosArray.value);
  console.log("已完成", completedTodosArray.value);
};

// 右键菜单
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  todoId: null,
});

// 保存待办列表到文件
const saveTodos = () => {
  try {
    // 检查utools是否存在
    if (window.services) {
      window.services.writeTodosFile(JSON.stringify(todos.value));
      // 保存后不再需要检查云同步状态
    }
  } catch (err) {
    console.error("保存待办列表失败：", err);
  }
};

// 加载待办列表
const loadTodos = () => {
  try {
    // 检查services是否存在
    if (window.services) {
      const content = window.services.readTodosFile();
      if (content) {
        todos.value = JSON.parse(content);
        // 确保所有待办项都有order字段
        todos.value.forEach((todo, index) => {
          if (todo.order === undefined) {
            if (todo.completed) {
              todo.order = index + 1000;
            } else {
              todo.order = index;
            }
          }
          // 记录当前最大order值
          if (todo.order > currentOrder.value) {
            currentOrder.value = todo.order;
          }
        });

        // 更新拖拽数组
        updateDraggableArrays();
      }
    }
  } catch (err) {
    console.error("读取待办列表失败：", err);
  }
};

// 添加新待办
const addTodo = () => {
  if (!newTodo.value.trim()) return;

  // 将新待办添加到列表最前面
  todos.value.unshift({
    id: generateId(),
    content: newTodo.value.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
    order: 0, // 添加排序字段
  });

  // 更新所有未完成待办的顺序
  todos.value
    .filter((todo) => !todo.completed)
    .forEach((todo, index) => {
      todo.order = index;
    });

  // 更新拖拽数组
  updateDraggableArrays();

  newTodo.value = "";
  saveTodos();

  // 重置输入框高度
  nextTick(() => {
    const textareaEl = document.querySelector(".new-todo-input");
    if (textareaEl) {
      textareaEl.style.height = "auto";
    }
  });
};

// 删除待办
const removeTodo = (id) => {
  todos.value = todos.value.filter((todo) => todo.id !== id);

  // 更新所有待办的顺序
  updateAllTodosOrder();

  // 更新拖拽数组
  updateDraggableArrays();

  saveTodos();
};

// 切换待办状态
const toggleTodo = (id) => {
  const todo = todos.value.find((todo) => todo.id === id);
  if (todo) {
    todo.completed = !todo.completed;

    // 重新分配序号
    if (todo.completed) {
      // 设置为已完成项的最前面
      todo.order = 1000;
    } else {
      // 设置为未完成项的最前面
      todo.order = 0;
    }

    // 更新拖拽数组
    updateDraggableArrays();

    saveTodos();
  }
};

// 开始编辑待办
const startEdit = (todo) => {
  // 如果正在拖拽，不进入编辑模式
  if (isDragging.value) {
    isDragging.value = false;
    return;
  }

  editingTodo.value = todo.id;
  editText.value = todo.content;

  // 在下一个渲染周期调整编辑框高度
  nextTick(() => {
    const editEl = document.querySelector(".edit-input");
    if (editEl) {
      adjustHeight(editEl);
    }
  });
};

// 保存编辑
const saveEdit = () => {
  if (!editText.value.trim()) {
    // 如果编辑后的内容为空，则删除该待办
    removeTodo(editingTodo.value);
  } else {
    // 查找并更新待办内容
    const todo = todos.value.find((todo) => todo.id === editingTodo.value);
    if (todo) {
      todo.content = editText.value.trim();
      saveTodos();
    }
  }
  // 退出编辑模式
  editingTodo.value = null;
};

// 取消编辑
const cancelEdit = () => {
  editingTodo.value = null;
};

// 处理编辑时的按键事件
const handleEditKeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); // 阻止默认的回车换行行为
    saveEdit();
  } else if (e.key === "Escape") {
    cancelEdit();
  }
};

// 处理新建待办的按键事件
const handleNewTodoKeydown = (e) => {
  if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
    e.preventDefault();
    addTodo();
  }
};

// 开始拖拽
const onStart = () => {
  isDragging.value = true;
  hideContextMenu();
};

// 处理拖拽结束
const onEnd = (e) => {
  console.log("拖拽结束", e);

  setTimeout(() => {
    isDragging.value = false;

    // 从拖拽数组更新原始数据
    updateTodosFromDraggableArrays();

    // 保存数据
    saveTodos();
  }, 100);
};

// 处理拖拽完成后的变更
const handleChange = (e) => {
  console.log("列表变更", e);

  // 标记需要更新
  setTimeout(() => {
    // 从拖拽数组更新原始数据
    updateTodosFromDraggableArrays();

    // 保存数据
    saveTodos();
  }, 0);
};

// 从拖拽数组更新原始数据
const updateTodosFromDraggableArrays = () => {
  console.log(
    "从拖拽数组更新",
    uncompletedTodosArray.value,
    completedTodosArray.value
  );

  // 更新未完成待办的顺序
  uncompletedTodosArray.value.forEach((todo, index) => {
    const realTodo = todos.value.find((t) => t.id === todo.id);
    if (realTodo) {
      realTodo.order = index;
      console.log(`更新未完成待办 ${todo.content} 的顺序为 ${index}`);
    }
  });

  // 更新已完成待办的顺序
  completedTodosArray.value.forEach((todo, index) => {
    const realTodo = todos.value.find((t) => t.id === todo.id);
    if (realTodo) {
      realTodo.order = index + 1000;
      console.log(`更新已完成待办 ${todo.content} 的顺序为 ${index + 1000}`);
    }
  });

  console.log("更新后的todos", todos.value);
};

// 更新所有待办项的顺序
const updateAllTodosOrder = () => {
  // 更新未完成待办的顺序
  todos.value
    .filter((todo) => !todo.completed)
    .forEach((todo, index) => {
      todo.order = index;
    });

  // 更新已完成待办的顺序
  todos.value
    .filter((todo) => todo.completed)
    .forEach((todo, index) => {
      todo.order = index + 1000;
    });
};

// 显示右键菜单
const showContextMenu = (e, todoId) => {
  e.preventDefault(); // 阻止默认右键菜单

  // 如果正在拖拽，不显示右键菜单
  if (isDragging.value) return;

  // 移除之前的事件监听
  document.removeEventListener("click", hideContextMenu);
  document.removeEventListener("contextmenu", hideContextMenuOnContext);

  // 设置菜单位置和关联的待办项
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    todoId,
  };

  // 添加事件监听器，以便在点击其他地方时隐藏菜单
  setTimeout(() => {
    document.addEventListener("click", hideContextMenu);
    document.addEventListener("contextmenu", hideContextMenuOnContext);
  }, 0);
};

// 隐藏右键菜单
const hideContextMenu = () => {
  contextMenu.value.visible = false;
};

// 在新的右键菜单出现时隐藏旧菜单
const hideContextMenuOnContext = (e) => {
  // 不立即隐藏，让新菜单有机会显示
  if (!e.target.closest(".context-menu")) {
    hideContextMenu();
  }
};

// 菜单操作 - 删除
const handleDeleteTodo = () => {
  if (contextMenu.value.todoId) {
    removeTodo(contextMenu.value.todoId);
    hideContextMenu();
  }
};

// 菜单操作 - 编辑
const handleEditTodo = () => {
  if (contextMenu.value.todoId) {
    const todo = todos.value.find(
      (todo) => todo.id === contextMenu.value.todoId
    );
    if (todo) {
      startEdit(todo);
      hideContextMenu();
    }
  }
};

// 菜单操作 - 切换完成状态
const handleToggleTodo = () => {
  if (contextMenu.value.todoId) {
    toggleTodo(contextMenu.value.todoId);
    hideContextMenu();
  }
};

// 监视todos变化，更新拖拽数组
watch(
  todos,
  () => {
    updateDraggableArrays();
  },
  { deep: true }
);

// 组件加载时读取待办列表
onMounted(() => {
  // 安全地注册插件进入事件
  if (window.utools) {
    window.utools.onPluginEnter(() => {
      loadTodos();
      // 不再需要检查云同步状态
    });
  }

  loadTodos();
  updateDraggableArrays();
  // 不再需要检查云同步状态

  // 监听全局点击事件，在点击编辑框外部时保存编辑
  document.addEventListener("click", (e) => {
    if (editingTodo.value && !e.target.closest(".editing")) {
      saveEdit();
    }
  });
});

// 组件卸载时清理事件监听
onUnmounted(() => {
  document.removeEventListener("click", hideContextMenu);
  document.removeEventListener("contextmenu", hideContextMenuOnContext);
});
</script>

<template>
  <div class="todo-app" @contextmenu.self="hideContextMenu">
    <!-- 添加待办表单 -->
    <div class="add-todo">
      <textarea
        v-model="newTodo"
        @keydown="handleNewTodoKeydown"
        placeholder="写点什么..."
        class="new-todo-input"
        v-auto-height
      ></textarea>
    </div>

    <!-- 未完成的待办列表 -->
    <draggable
      v-model="uncompletedTodosArray"
      class="todo-list"
      :animation="150"
      ghost-class="ghost-todo"
      handle=".drag-handle"
      @start="onStart"
      @end="onEnd"
      @change="handleChange"
      item-key="id"
    >
      <template #item="{ element: todo }">
        <div
          class="todo-item"
          :class="{
            completed: todo.completed,
            editing: editingTodo === todo.id,
          }"
          @contextmenu.stop="showContextMenu($event, todo.id)"
        >
          <div class="todo-content" @dblclick="startEdit(todo)">
            <input
              type="checkbox"
              :checked="todo.completed"
              @change="toggleTodo(todo.id)"
            />
            <!-- 显示模式 -->
            <span
              v-if="editingTodo !== todo.id"
              :class="{ 'todo-completed': todo.completed }"
            >
              {{ todo.content }}
            </span>
            <!-- 编辑模式 -->
            <textarea
              v-else
              class="edit-input"
              v-model="editText"
              @keydown="handleEditKeydown"
              ref="editInput"
              v-focus
              v-auto-height
            ></textarea>

            <div class="drag-handle">
              <span class="drag-icon">≡</span>
            </div>
          </div>
        </div>
      </template>
    </draggable>

    <!-- 分隔线 -->
    <div
      v-if="uncompletedTodosArray.length > 0 && completedTodosArray.length > 0"
      class="todo-divider"
    >
      <span>已完成</span>
    </div>

    <!-- 已完成的待办列表 -->
    <draggable
      v-if="completedTodosArray.length > 0"
      v-model="completedTodosArray"
      class="todo-list completed-list"
              :animation="150"
        ghost-class="ghost-todo"
        handle=".drag-handle"
        @start="onStart"
        @end="onEnd"
      @change="handleChange"
      item-key="id"
    >
      <template #item="{ element: todo }">
        <div
          class="todo-item"
          :class="{
            completed: todo.completed,
            editing: editingTodo === todo.id,
          }"
          @contextmenu.stop="showContextMenu($event, todo.id)"
        >
          <div class="todo-content" @dblclick="startEdit(todo)">
            <div class="drag-handle">
              <span class="drag-icon">≡</span>
            </div>
            <input
              type="checkbox"
              :checked="todo.completed"
              @change="toggleTodo(todo.id)"
            />
            <!-- 显示模式 -->
            <span
              v-if="editingTodo !== todo.id"
              :class="{ 'todo-completed': todo.completed }"
            >
              {{ todo.content }}
            </span>
            <!-- 编辑模式 -->
            <textarea
              v-else
              class="edit-input"
              v-model="editText"
              @keydown="handleEditKeydown"
              ref="editInput"
              v-focus
              v-auto-height
            ></textarea>
          </div>
        </div>
      </template>
    </draggable>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      @click.stop
      @contextmenu.stop
    >
      <div class="context-menu-item" @click="handleEditTodo">
        <span>编辑</span>
      </div>
      <div class="context-menu-item" @click="handleToggleTodo">
        <span
          >标记{{
            todos.find((t) => t.id === contextMenu.todoId)?.completed
              ? "未完成"
              : "已完成"
          }}</span
        >
      </div>
      <div class="context-menu-item delete" @click="handleDeleteTodo">
        <span>删除</span>
      </div>
    </div>
  </div>
</template>

<style>
.todo-app {
  margin: 0 auto;
  padding: 10px 20px;
  font-family: "PingFang SC", "Helvetica Neue", Arial, sans-serif;
  position: relative;
}

.add-todo {
  margin-bottom: 20px;
}

.new-todo-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  resize: none;
  overflow: hidden;
  min-height: 24px;
  line-height: 1.5;
  font-family: inherit;
}

.todo-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 12px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: default;
}

.todo-item:hover {
  background-color: #f8f9fa;
}

.todo-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

/* 自定义复选框样式 */
.todo-content input[type="checkbox"] {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border: 2px solid #ddd;
  border-radius: 4px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 2px;
}

.todo-content input[type="checkbox"]:checked {
  background-color: #42b983;
  border-color: #42b983;
}

.todo-content input[type="checkbox"]:checked::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 3px;
  height: 7px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.todo-content input[type="checkbox"]:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.3);
}

.todo-content span {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.3;
  padding-top: 1px;
  flex: 1;
}

.todo-completed {
  text-decoration: line-through;
  color: #6c757d;
}

/* 拖拽相关样式 */
.drag-handle {
  cursor: grab;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.todo-item:hover .drag-handle {
  opacity: 1;
}

.drag-icon {
  font-size: 18px;
  display: inline-block;
  line-height: 1;
  color: #adb5bd;
  user-select: none;
}

.ghost-todo {
  opacity: 0.5;
  background: #e9ecef;
  border: 1px dashed #adb5bd;
}

.todo-list {
  min-height: 10px;
}

.completed-list {
  opacity: 0.8;
}

.todo-divider {
  text-align: center;
  margin: 20px 0;
  position: relative;
}

.todo-divider::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background-color: #e9ecef;
  z-index: 0;
}

.todo-divider span {
  position: relative;
  padding: 0 10px;
  font-size: 12px;
  color: #868e96;
  z-index: 1;
}

/* 编辑模式样式 */
.edit-input {
  flex: 1;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #4dabf7;
  border-radius: 3px;
  font-size: 14px;
  background-color: #fff;
  box-shadow: 0 0 0 2px rgba(77, 171, 247, 0.2);
  box-sizing: border-box;
  resize: none;
  overflow: hidden;
  min-height: 24px;
  line-height: 1.5;
  font-family: inherit;
}

.todo-item.editing .todo-content {
  flex: 1;
  width: 100%;
  align-items: flex-start;
}

/* 在编辑模式下隐藏复选框和拖拽手柄 */
.todo-item.editing input[type="checkbox"],
.todo-item.editing .drag-handle {
  display: none;
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  padding: 4px 0;
  min-width: 150px;
  z-index: 1000;
}

.context-menu-item {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background-color: #f0f0f0;
}

.context-menu-item.delete {
  color: #dc3545;
}

.context-menu-item.delete:hover {
  background-color: rgba(220, 53, 69, 0.1);
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .todo-app {
    background-color: #2c3e50;
    color: #f8f9fa;
  }

  .todo-item {
    background-color: #3a4d5f;
    border-color: #384a5c;
  }

  .todo-item:hover {
    background-color: #465c73;
  }

  .new-todo-input,
  .edit-input {
    background-color: #3a4d5f;
    border-color: #384a5c;
    color: #f8f9fa;
  }

  .new-todo-input::placeholder,
  .edit-input::placeholder {
    color: #adb5bd;
  }

  /* 深色模式下的复选框样式 */
  .todo-content input[type="checkbox"] {
    border-color: #4d6278;
  }

  .todo-content input[type="checkbox"]:checked {
    background-color: #2B70B9;
    border-color: #2B70B9;
  }

  .drag-icon {
    color: #8195a9;
  }

  .ghost-todo {
    background: #425b76;
    border: 1px dashed #5b788f;
  }

  .todo-divider::before {
    background-color: #4d6278;
  }

  .todo-divider span {
    background-color: #2c3e50;
    color: #adb5bd;
  }

  .context-menu {
    background-color: #3a4d5f;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
    border: 1px solid #384a5c;
  }

  .context-menu-item:hover {
    background-color: #465c73;
  }

  .context-menu-item.delete:hover {
    background-color: rgba(220, 53, 69, 0.2);
  }
}
</style>

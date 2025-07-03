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
  checked: false,
});

// 设置选项
const settings = ref({
  autoCleanEnabled: false, // 是否启用自动清理
  autoCleanDays: 30, // 自动清理多少天前的已完成待办
  autoCleanOnStartup: true, // 是否在启动时执行自动清理
  showArchiveOption: true, // 是否显示归档选项
  lastCleanTime: null, // 上次清理时间
});

// 归档的待办项
const archivedTodos = ref([]);

// 加载设置
const loadSettings = () => {
  try {
    if (window.services) {
      const settingsContent = window.services.readSettingsFile();
      if (settingsContent) {
        settings.value = { ...settings.value, ...JSON.parse(settingsContent) };
      }
    }
  } catch (err) {
    console.error("读取设置失败：", err);
  }
};

// 保存设置
const saveSettings = () => {
  try {
    if (window.services) {
      window.services.writeSettingsFile(JSON.stringify(settings.value));
    }
  } catch (err) {
    console.error("保存设置失败：", err);
  }
};

// 加载归档的待办项
const loadArchivedTodos = () => {
  try {
    if (window.services) {
      let archivedContent = "";

      // 优先从云同步获取
      if (window.services.syncArchivedTodos) {
        archivedContent = window.services.syncArchivedTodos();
      }

      // 如果云同步没有数据，尝试从本地获取
      if (!archivedContent || archivedContent === "[]") {
        archivedContent = window.services.readArchivedTodosFile();
      }

      if (archivedContent) {
        archivedTodos.value = JSON.parse(archivedContent);
      }
    }
  } catch (err) {
    console.error("读取归档待办失败：", err);
  }
};

// 保存归档的待办项
const saveArchivedTodos = () => {
  try {
    if (window.services) {
      // 本地存储
      window.services.writeArchivedTodosFile(
        JSON.stringify(archivedTodos.value)
      );

      // 云同步存储
      if (window.services.saveArchivedToCloud) {
        window.services.saveArchivedToCloud(
          JSON.stringify(archivedTodos.value)
        );
      }
    }
  } catch (err) {
    console.error("保存归档待办失败：", err);
  }
};

// 检查云同步状态（保留功能但不显示）
const checkCloudSyncStatus = () => {
  try {
    if (window.services && window.services.checkCloudSyncState) {
      const state = window.services.checkCloudSyncState();
      cloudSync.value = {
        ...state,
        checked: true,
      };
      // 如果正在同步，可以在控制台记录信息，但不在界面上显示
      console.log("云同步状态:", cloudSync.value);
    }
  } catch (err) {
    console.error("检查云同步状态失败:", err);
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

// 设置菜单状态
const settingsMenu = ref({
  visible: false,
});

// 归档查看状态
const archiveView = ref({
  visible: false,
});

// 显示设置菜单
const showSettingsMenu = () => {
  settingsMenu.value.visible = true;
};

// 隐藏设置菜单（不保存设置）
const hideSettingsMenu = () => {
  settingsMenu.value.visible = false;
  console.log("关闭设置菜单");
};

// 保存设置并关闭菜单
const saveSettingsAndClose = () => {
  saveSettings(); // 保存设置
  settingsMenu.value.visible = false;
  console.log("设置已保存");

  // 显示保存成功的提示
  alert("设置已保存！");
};

// 显示归档查看
const showArchiveView = () => {
  archiveView.value.visible = true;
};

// 隐藏归档查看
const hideArchiveView = () => {
  archiveView.value.visible = false;
  console.log(`归档视图已关闭，当前有 ${archivedTodos.value.length} 个归档项`);
};

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

// 删除待办（实际移入归档）
const removeTodo = (id) => {
  // 找到要删除的待办项
  const todoToArchive = todos.value.find((todo) => todo.id === id);

  if (!todoToArchive) {
    console.error(`未找到ID为 ${id} 的待办项`);
    return;
  }

  console.log(`将待办项移入归档: ${todoToArchive.content}`);

  // 确保待办项有完成时间
  if (!todoToArchive.completedAt) {
    todoToArchive.completedAt = new Date().toISOString();
  }

  // 记录原始完成状态，但不修改它
  // 保留原始状态以便后续恢复
  console.log(`归档待办项 ${todoToArchive.content} 的原始完成状态: ${todoToArchive.completed}`);
  
  // 不再强制标记为已完成
  // 保持原有状态，让恢复功能可以正确判断

  // 将待办项添加到归档
  archivedTodos.value.unshift(todoToArchive);

  // 从待办列表中移除
  todos.value = todos.value.filter((todo) => todo.id !== id);

  // 更新所有待办的顺序
  updateAllTodosOrder();

  // 更新拖拽数组
  updateDraggableArrays();

  // 保存更改
  saveTodos();
  saveArchivedTodos();
};

// 切换待办状态
const toggleTodo = (id) => {
  const todo = todos.value.find((todo) => todo.id === id);
  if (todo) {
    const wasCompleted = todo.completed;
    todo.completed = !wasCompleted;

    // 如果标记为已完成，记录完成时间
    if (todo.completed) {
      // 始终为新完成的待办项设置当前时间
      todo.completedAt = new Date().toISOString();
      console.log(
        `待办项 ${todo.content} 标记为已完成，完成时间: ${todo.completedAt}`
      );

      // 获取当前最小的已完成项序号
      const minCompletedOrder = Math.min(
        ...todos.value
          .filter((t) => t.completed && t.id !== id)
          .map((t) => t.order),
        1000 // 默认值
      );
      // 设置为已完成项的最前面
      todo.order = minCompletedOrder - 1;
    } else {
      // 取消完成状态时，移除完成时间
      console.log(`待办项 ${todo.content} 标记为未完成，移除完成时间`);
      delete todo.completedAt;

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

// 菜单操作 - 删除（移入归档）
const handleDeleteTodo = () => {
  if (contextMenu.value.todoId) {
    const todo = todos.value.find((t) => t.id === contextMenu.value.todoId);
    if (todo) {
      removeTodo(contextMenu.value.todoId);
      hideContextMenu();
    }
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

// 全局键盘事件处理函数
const handleGlobalKeydown = (e) => {
  // 如果按下Tab键，并且当前没有处于输入或编辑状态
  if (
    e.key === "Tab" &&
    !editingTodo.value &&
    document.activeElement.tagName !== "TEXTAREA"
  ) {
    e.preventDefault();
    // 聚焦到输入框
    const textarea = document.querySelector(".new-todo-input");
    if (textarea) {
      textarea.focus();
    }
  }
};

// 自动清理旧的已完成待办项
const cleanOldCompletedTodos = () => {
  // 临时记录是否为手动清理调用
  const isManualClean = settings.value._manualClean === true;
  // 重置手动清理标志
  settings.value._manualClean = false;

  // 检查是否启用自动清理（手动清理时会跳过此检查）
  if (!settings.value.autoCleanEnabled && !isManualClean) {
    console.log("自动清理未启用");
    return;
  }

  console.log("开始清理旧待办项", isManualClean ? "(手动触发)" : "");

  // 确保天数是有效的数字
  const cleanDays = Math.max(1, parseInt(settings.value.autoCleanDays) || 30);
  console.log(`清理天数设置: ${cleanDays}天`);

  const now = new Date();
  const cutoffDate = new Date();
  cutoffDate.setDate(now.getDate() - cleanDays);

  console.log(`清理截止日期: ${cutoffDate.toISOString()}`);

  // 为所有已完成但没有完成时间的待办项添加完成时间
  todos.value.forEach((todo) => {
    if (todo.completed && !todo.completedAt) {
      // 为旧的已完成项设置完成时间为截止日期之前，以便它们被归档
      todo.completedAt = new Date(
        now.getTime() - (cleanDays + 1) * 24 * 60 * 60 * 1000
      ).toISOString();
      console.log(
        `为待办项添加完成时间: ${todo.content}, 设置为: ${todo.completedAt}`
      );
    }
  });

  // 找出需要归档的待办项
  const todosToArchive = todos.value.filter((todo) => {
    if (!todo.completed) return false;
    if (!todo.completedAt) return false;

    const completedDate = new Date(todo.completedAt);
    const shouldArchive = completedDate < cutoffDate;

    if (shouldArchive) {
      console.log(`待归档: ${todo.content}, 完成于 ${todo.completedAt}`);
    }

    return shouldArchive;
  });

  console.log(`找到 ${todosToArchive.length} 个需要归档的待办项`);

  if (todosToArchive.length === 0) {
    console.log("没有需要归档的待办项");
    return;
  }

  // 将旧待办项添加到归档
  archivedTodos.value = [...archivedTodos.value, ...todosToArchive];

  console.log(`归档后总数: ${archivedTodos.value.length}`);

  // 从当前列表中移除
  todos.value = todos.value.filter((todo) => {
    // 保留未完成的和完成时间晚于截止日期的
    if (!todo.completed) return true;
    if (!todo.completedAt) return true;

    const completedDate = new Date(todo.completedAt);
    return completedDate >= cutoffDate;
  });

  // 更新拖拽数组
  updateDraggableArrays();

  // 保存更改
  saveTodos();
  saveArchivedTodos();

  // 更新最后清理时间
  settings.value.lastCleanTime = now.toISOString();
  saveSettings();

  console.log(`已归档 ${todosToArchive.length} 个旧待办项`);
};

// 手动触发清理
const manualCleanOldTodos = () => {
  // 设置手动清理标志
  settings.value._manualClean = true;

  // 确保所有已完成项都有完成时间
  let addedCompletionTime = false;
  todos.value.forEach((todo) => {
    if (todo.completed && !todo.completedAt) {
      // 设置完成时间为比截止日期更早一天
      const daysAgo = parseInt(settings.value.autoCleanDays) || 30;
      const completedDate = new Date();
      completedDate.setDate(completedDate.getDate() - (daysAgo + 1));
      todo.completedAt = completedDate.toISOString();
      addedCompletionTime = true;
    }
  });

  if (addedCompletionTime) {
    saveTodos();
  }

  // 执行清理
  cleanOldCompletedTodos();

  // 显示清理结果的反馈
  const cleanDays = Math.max(1, parseInt(settings.value.autoCleanDays) || 30);
  const archivedCount = archivedTodos.value.length;

  // 检查是否有项目被归档
  if (archivedCount > 0) {
    alert(
      `清理完成！已将${cleanDays}天前的已完成待办移至归档。\n当前归档共有${archivedCount}个项目。`
    );
  } else {
    alert(
      `没有找到${cleanDays}天前的已完成待办。\n如需归档当前的已完成项，请调整设置中的天数。`
    );
  }
};

// 手动查看归档
const viewArchivedTodos = () => {
  // 打开归档查看模态框
  archiveView.value.visible = true;
  console.log("查看归档待办项", archivedTodos.value);
};

// 从归档中恢复待办项
const restoreFromArchive = (todo) => {
  // 获取原始完成状态
  const wasCompleted = !!todo.completed;
  
  // 确认对话框 - 根据原始完成状态显示不同消息
  const confirmMessage = wasCompleted 
    ? `确定要将"${todo.content}"恢复到已完成列表吗？` 
    : `确定要将"${todo.content}"恢复到待办列表吗？`;
    
  if (!confirm(confirmMessage)) {
    return;
  }

  console.log(`从归档恢复待办项: ${todo.content}, 完成状态: ${wasCompleted}`);

  // 从归档中移除
  archivedTodos.value = archivedTodos.value.filter((t) => t.id !== todo.id);

  if (wasCompleted) {
    // 如果原本是已完成状态，保持已完成
    // 如果没有完成时间，则添加一个较近的完成时间
    if (!todo.completedAt) {
      // 设置为昨天完成，确保不会立即被再次归档
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      todo.completedAt = yesterday.toISOString();
    }
    
    // 设置为已完成项的最前面
    const minCompletedOrder = Math.min(
      ...todos.value.filter((t) => t.completed).map((t) => t.order),
      1000 // 默认值
    );
    todo.order = minCompletedOrder - 1;
  } else {
    // 如果原本是未完成状态，恢复为未完成
    todo.completed = false;
    delete todo.completedAt; // 移除完成时间
    
    // 设置为未完成项的最前面
    todo.order = -1; // 设置为小于所有现有项的顺序
    
    // 重新排序未完成项
    todos.value
      .filter(t => !t.completed)
      .forEach((t, index) => {
        t.order = index + 1;
      });
  }

  // 添加到当前待办列表
  todos.value.unshift(todo);

  // 更新拖拽数组
  updateDraggableArrays();

  // 保存更改
  saveTodos();
  saveArchivedTodos();
};

// 彻底删除所有归档项
const clearAllArchived = () => {
  // 确认对话框，要求二次确认
  if (
    !confirm(
      `确定要永久删除所有归档项吗？此操作无法撤销，共 ${archivedTodos.value.length} 项将被删除。`
    )
  ) {
    return;
  }

  console.log(`永久删除所有归档项: ${archivedTodos.value.length} 项`);

  // 清空归档
  archivedTodos.value = [];

  // 保存归档
  saveArchivedTodos();

};

// 组件加载时读取待办列表
onMounted(() => {
  // 安全地注册插件进入事件
  if (window.utools) {
    window.utools.onPluginEnter(() => {
      loadTodos();
      loadSettings();
      loadArchivedTodos();

      // 如果启用了启动时自动清理，执行清理
      if (
        settings.value.autoCleanEnabled &&
        settings.value.autoCleanOnStartup
      ) {
        cleanOldCompletedTodos();
      }
    });
  }

  loadTodos();
  loadSettings();
  loadArchivedTodos();
  updateDraggableArrays();

  // 如果启用了启动时自动清理，执行清理
  if (settings.value.autoCleanEnabled && settings.value.autoCleanOnStartup) {
    cleanOldCompletedTodos();
  }

  // 监听全局点击事件，在点击编辑框外部时保存编辑
  document.addEventListener("click", (e) => {
    if (editingTodo.value && !e.target.closest(".editing")) {
      saveEdit();
    }
  });

  // 添加全局键盘事件监听
  document.addEventListener("keydown", handleGlobalKeydown);

  // 添加全局ESC键监听
  document.addEventListener("keydown", handleGlobalEscape);
});

// 全局按键处理 - 用于关闭模态框
const handleGlobalEscape = (e) => {
  if (e.key === "Escape") {
    // 如果设置模态框可见，关闭它（不保存更改）
    if (settingsMenu.value.visible) {
      hideSettingsMenu();
    }
    // 如果归档查看可见，关闭它
    else if (archiveView.value.visible) {
      hideArchiveView();
    }
  }
};

// ESC键监听在组件挂载时添加

// 组件卸载时清理事件监听
onUnmounted(() => {
  document.removeEventListener("click", hideContextMenu);
  document.removeEventListener("contextmenu", hideContextMenuOnContext);
  document.removeEventListener("keydown", handleGlobalKeydown);
  document.removeEventListener("keydown", handleGlobalEscape);
});
</script>

<template>
  <div class="todo-app" @contextmenu.self="hideContextMenu">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <button class="toolbar-button" @click="showSettingsMenu" title="设置">
        <span class="setting-icon">⚙️</span>
      </button>
      <button
        v-if="settings.showArchiveOption"
        class="toolbar-button"
        @click="showArchiveView"
        title="查看归档"
      >
        <span class="archive-icon">📦</span>
      </button>
    </div>

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

    <!-- 设置菜单 -->
    <div
      v-if="settingsMenu.visible"
      class="settings-modal"
      @click.self="hideSettingsMenu"
    >
      <div class="settings-content">
        <div class="settings-header">
          <h2>设置</h2>
          <button class="close-button" @click="hideSettingsMenu">×</button>
        </div>
        <div class="settings-body">
          <div class="setting-item">
            <label>
              <input type="checkbox" v-model="settings.autoCleanEnabled" />
              1. 启用清理已完成待办功能
            </label>
          </div>
          <div class="setting-item" v-if="settings.autoCleanEnabled">
            <label>
              自动清理多少天前的已完成待办:
              <input
                type="number"
                v-model.number="settings.autoCleanDays"
                min="1"
                max="365"
              />
            </label>
          </div>
          <div class="setting-item" v-if="settings.autoCleanEnabled">
            <label>
              <input type="checkbox" v-model="settings.autoCleanOnStartup" />
              在启动时执行自动清理
            </label>
          </div>
          <div class="setting-tip" v-if="settings.autoCleanEnabled">
            <p>
              注意:
              只有设置了完成时间的待办项才会被清理，旧的已完成项可能需要手动点击"立即清理"来添加完成时间并归档。
            </p>
          </div>
          <div class="setting-item">
            <label>
              <input type="checkbox" v-model="settings.showArchiveOption" />
              2. 显示归档选项
            </label>
          </div>
          <div class="setting-actions">
            <button class="button primary" @click="saveSettingsAndClose">
              保存
            </button>
            <button
              v-if="settings.autoCleanEnabled"
              class="button warnning"
              @click="manualCleanOldTodos"
              :disabled="completedTodosArray.length === 0"
            >
              立即清理
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 归档查看 -->
    <div
      v-if="archiveView.visible"
      class="archive-modal"
      @click.self="hideArchiveView"
    >
      <div class="archive-content">
        <div class="archive-header">
          <h2>
            归档待办
            <span class="archive-count" v-if="archivedTodos.length > 0"
              >({{ archivedTodos.length }})</span
            >
          </h2>
          <div class="archive-header-actions">
            <button
              v-if="archivedTodos.length > 0"
              class="archive-clear-btn"
              @click="clearAllArchived"
              title="彻底删除所有归档项"
            >
              彻底删除全部
            </button>
            <button class="close-button" @click="hideArchiveView">×</button>
          </div>
        </div>
        <div class="archive-body">
          <div v-if="archivedTodos.length === 0" class="no-archived">
            <p>暂无归档的待办项</p>
          </div>
          <div v-else class="archived-list">
            <div
              v-for="todo in archivedTodos"
              :key="todo.id"
              class="archived-item"
            >
              <div class="archived-content">
                <span class="archived-text">{{ todo.content }}</span>
                <span class="archived-date">
                  完成于:
                  {{
                    todo.completedAt
                      ? new Date(todo.completedAt).toLocaleDateString()
                      : "未知时间"
                  }}
                </span>
              </div>
              <div class="archived-actions">
                <button
                  class="archive-action-btn restore"
                  @click="restoreFromArchive(todo)"
                  :title="todo.completed ? '恢复到已完成列表' : '恢复到待办列表'"
                >
                  <span>恢复</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

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
        <span>归档</span>
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

/* 顶部工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9;
}

.toolbar-button {
  width: 40px;
  height: 40px;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.toolbar-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

/* 设置模态框 */
.settings-modal,
.archive-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  cursor: pointer;
}

.settings-content,
.archive-content {
  cursor: default;
}

.settings-content,
.archive-content {
  background-color: #fff;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.settings-header,
.archive-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.archive-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.archive-clear-btn {
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background-color: #dc3545;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.archive-clear-btn:hover {
  background-color: #c82333;
}

.settings-header h2,
.archive-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.archive-count {
  font-size: 14px;
  font-weight: normal;
  color: #666;
  margin-left: 4px;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0 5px;
  line-height: 1;
  color: #333;
}

.settings-body,
.archive-body {
  padding: 20px;
  overflow-y: auto;
}

.setting-item {
  margin-bottom: 15px;
}

.setting-item label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.setting-tip {
  margin: 0 0 15px;
  padding: 8px 12px;
  background-color: #fff8e1;
  border-left: 3px solid #ffca28;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
}

.setting-tip p {
  margin: 0;
  color: #795548;
}

.setting-item input[type="number"] {
  width: 60px;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.setting-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.button {
  padding: 0 15px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  background-color: #f0f0f0;
  transition: all 0.2s;
}

.button.primary {
  background-color: #42b983;
  color: white;
}

.button.warnning {
  background-color: #e00;
  color: white;
}

.button:hover:not(:disabled) {
  opacity: 0.9;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 归档列表样式 */
.archived-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.archived-item {
  padding: 12px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border-left: 3px solid #aaa;
}

.archived-content {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.archived-text {
  font-size: 14px;
}

.archived-date {
  font-size: 12px;
  color: #888;
}

.archived-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.archived-actions {
  display: flex;
  gap: 8px;
}

.archive-action-btn {
  padding: 0 8px;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.archive-action-btn.restore {
  background-color: #4285f4;
  color: white;
}

.archive-action-btn.delete {
  background-color: #dc3545;
  color: white;
}

.archive-action-btn:hover {
  opacity: 0.8;
}

.no-archived {
  text-align: center;
  padding: 30px 0;
  color: #888;
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
    background-color: #2b70b9;
    border-color: #2b70b9;
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

  .toolbar-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .settings-content,
  .archive-content {
    background-color: #3a4d5f;
    border: 1px solid #2c3e50;
  }

  .settings-header,
  .archive-header {
    border-bottom: 1px solid #2c3e50;
  }

  .setting-item input[type="number"] {
    background-color: #2c3e50;
    border-color: #2c3e50;
    color: #f8f9fa;
  }

  .setting-tip {
    background-color: #2c3e50;
    border-left-color: #f39c12;
  }

  .setting-tip p {
    color: #ddd;
  }

  .button {
    background-color: #2c3e50;
    color: #f8f9fa;
  }

  .button.primary {
    background-color: #2b70b9;
  }

  .archived-item {
    background-color: #2c3e50;
    border-left: 3px solid #4d6278;
  }

  .archived-date {
    color: #adb5bd;
  }

  .archive-action-btn.restore {
    background-color: #2b70b9;
  }

  .archive-action-btn.delete {
    background-color: #a03;
  }

  .archive-count {
    color: #adb5bd;
  }

  .archive-clear-btn {
    background-color: #a03;
  }

  .archive-clear-btn:hover {
    background-color: #bf0a30;
  }
}
</style>

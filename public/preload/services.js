const fs = require('node:fs')
const path = require('node:path')

// 通过 window 对象向渲染进程注入 nodejs 能力
window.services = {
  // 读文件
  readFile (file) {
    return fs.readFileSync(file, { encoding: 'utf-8' })
  },
  // 文本写入到下载目录
  writeTextFile (text) {
    const filePath = path.join(window.utools.getPath('downloads'), Date.now().toString() + '.txt')
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },
  // 图片写入到下载目录
  writeImageFile (base64Url) {
    const matchs = /^data:image\/([a-z]{1,20});base64,/i.exec(base64Url)
    if (!matchs) return
    const filePath = path.join(window.utools.getPath('downloads'), Date.now().toString() + '.' + matchs[1])
    fs.writeFileSync(filePath, base64Url.substring(matchs[0].length), { encoding: 'base64' })
    return filePath
  },
  // 读取待办列表数据 - 使用dbStorage API支持云同步
  readTodosFile () {
    try {
      const todos = window.utools.dbStorage.getItem('todos')
      if (todos) {
        return JSON.stringify(todos)
      }
      
      // 尝试从旧存储位置读取以实现数据迁移
      const todosPath = path.join(window.utools.getPath('userData'), 'todos.json')
      if (fs.existsSync(todosPath)) {
        const oldData = fs.readFileSync(todosPath, { encoding: 'utf-8' })
        if (oldData) {
          // 迁移旧数据到新的存储方式
          try {
            const parsedData = JSON.parse(oldData)
            window.utools.dbStorage.setItem('todos', parsedData)
            console.log('已将旧数据迁移到云同步存储')
            // 可选：删除旧文件
            // fs.unlinkSync(todosPath)
          } catch (e) {
            console.error('数据迁移失败:', e)
          }
          return oldData
        }
      }
      
      // 如果没有数据，返回空数组
      return '[]'
    } catch (err) {
      console.error('读取待办列表失败:', err)
      return '[]'
    }
  },
  // 写入待办列表数据 - 使用dbStorage API支持云同步
  writeTodosFile (todosJson) {
    try {
      const todosData = JSON.parse(todosJson)
      window.utools.dbStorage.setItem('todos', todosData)
      return true
    } catch (err) {
      console.error('保存待办列表失败:', err)
      return false
    }
  },
  // 检查云同步状态
  checkCloudSyncState () {
    try {
      // 如果uTools的db API可用，检查云同步状态
      if (window.utools && window.utools.db && window.utools.db.replicateStateFromCloud) {
        const state = window.utools.db.replicateStateFromCloud()
        return {
          enabled: state !== null,
          syncing: state === 1,
          completed: state === 0
        }
      }
      return { enabled: false, syncing: false, completed: false }
    } catch (err) {
      console.error('检查云同步状态失败:', err)
      return { enabled: false, syncing: false, completed: false }
    }
  },
  // 云同步支持归档功能
  syncArchivedTodos: function() {
    try {
      // 从dbStorage获取归档数据
      const archived = window.utools.dbStorage.getItem('todos-archived')
      if (archived) {
        return JSON.stringify(archived)
      }
      return '[]'
    } catch (err) {
      console.error('获取归档数据失败:', err)
      return '[]'
    }
  },
  
  // 将归档数据同步到云
  saveArchivedToCloud: function(archivedJson) {
    try {
      const archivedData = JSON.parse(archivedJson)
      window.utools.dbStorage.setItem('todos-archived', archivedData)
      return true
    } catch (err) {
      console.error('保存归档数据到云失败:', err)
      return false
    }
  },
  // 写入设置
  writeSettingsFile: function (content) {
    try {
      fs.writeFileSync(path.join(window.utools.getPath('userData'), 'todos-settings.json'), content, 'utf8')
      return true
    } catch (e) {
      console.error('写入设置失败', e)
      return false
    }
  },
  // 读取设置
  readSettingsFile: function () {
    try {
      const settingsPath = path.join(window.utools.getPath('userData'), 'todos-settings.json')
      if (fs.existsSync(settingsPath)) {
        return fs.readFileSync(settingsPath, 'utf8')
      }
      return ''
    } catch (e) {
      console.error('读取设置失败', e)
      return ''
    }
  },
  // 写入归档待办
  writeArchivedTodosFile: function (content) {
    try {
      const archivedPath = path.join(window.utools.getPath('userData'), 'todos-archived.json')
      fs.writeFileSync(archivedPath, content, 'utf8')
      return true
    } catch (e) {
      console.error('写入归档待办失败', e)
      return false
    }
  },
  // 读取归档待办
  readArchivedTodosFile: function () {
    try {
      const archivedPath = path.join(window.utools.getPath('userData'), 'todos-archived.json')
      if (fs.existsSync(archivedPath)) {
        return fs.readFileSync(archivedPath, 'utf8')
      }
      return ''
    } catch (e) {
      console.error('读取归档待办失败', e)
      return ''
    }
  }
}

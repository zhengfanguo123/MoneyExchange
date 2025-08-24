# 使用轻量的 Python 3.12 官方镜像
FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# 只复制 requirements.txt 并先安装依赖（利用缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 再复制剩余的代码（app.py、static、templates 等）
COPY . .

# AWS App Runner 会注入环境变量 PORT，我们监听它
ENV PORT=8080

# 入口命令：用 gunicorn 启动 Flask 应用
# app:app 的意思是 app.py 文件里的变量 app
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:${PORT}", "app:app"]

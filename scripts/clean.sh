#!/bin/bash

# 清理所有 package 的构建产物

echo "清理构建产物..."

# 清理根目录
rm -rf node_modules

# 清理各个 package
for dir in packages/*; do
  if [ -d "$dir" ]; then
    echo "清理 $dir"
    rm -rf "$dir/node_modules"
    rm -rf "$dir/dist"
  fi
done

echo "清理完成"

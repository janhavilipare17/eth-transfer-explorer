with open('D:/wallet-explorer/public/index.html', 'r') as f:
    content = f.read()

# Find the location after catERC1155.addEventListener and add default external active
marker = "catERC1155.addEventListener('erc1155')"
if marker in content:
    # Insert after this marker
    insertion = "\n    // Set 'external' as default active filter on page load\n    catExternal.classList.add('active');"
    # Find the position after the marker and add newline + insertion
    pos = content.find(marker) + len(marker)
    content = content[:pos] + insertion + content[pos:]
    
    with open('D:/wallet-explorer/public/index.html', 'w') as f:
        f.write(content)
    print('Added default external active state')
else:
    print('Marker not found')
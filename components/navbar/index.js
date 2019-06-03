//toggle active and inactive
$('.ui.menu a.item').on('click', function () {
  $(this)
    .addClass('active')
    .siblings()
    .removeClass('active');
})



class NavBar {

  constructor() {
    window.dataX = this.getJson();// This is only a prototype
    this.data = this.getJson();// This is only a prototype
  }

  tagName() {
    return "navbar";
  }

  getCssDependencies() {
    const baseDependencies = super.getCssDependencies();
    baseDependencies.push(['']);
    return baseDependencies
  }

  getJson() {
    let jsonData = {
      "@title": "",
      "@icon": "",
      "@navBarType": "standard",
      "@orientation": "horizontal",
      "@navPointer": false,
      "@separator": false,
      "@navBarAlignment": "",
      "@menuStyle": "text",
      ">": [{
        "@tag": "group",
        "@position": "left",
        ">": [{
          "@tag": "item",
          "@title": "Home",
          "@iconName": "",
          "@iconOnly": false,
          "@iconPosition": "",
          "@active": false,
          "@url": ""
        }, {
          "@tag": "item",
          "@title": "News",
          "@iconOnly": true,
          "@iconName": "",
          "@iconPosition": "right",
          "@active": false,
          "@url": "",
          ">": [{
            "@tag": "item",
            "@title": "Sports News",
            "@url": ""
          }, {
            "@tag": "item",
            "@title": "Football News",
            "@groupName": "Sports",
            "@url": "",
            ">": [{
              "@tag": "item",
              "@title": "Sports News",
              "@url": ""
            }, {
              "@tag": "item",
              "@title": "Football News",
              "@url": ""
            }, {
              "@tag": "item",
              "@title": "BasketBall News",
              "@url": ""
            }, {
              "@tag": "item",
              "@title": "Golf News",
              "@url": ""
            }, {
              "@tag": "item",
              "@title": "Tennis News",
              "@url": "",
              ">": [{
                "@tag": "item",
                "@title": "Sports News",
                "@url": ""
              }, {
                "@tag": "item",
                "@title": "Football News",
                "@url": ""
              }, {
                "@tag": "item",
                "@title": "BasketBall News",
                "@url": ""
              }, {
                "@tag": "item",
                "@title": "Golf News",
                "@url": ""
              }, {
                "@tag": "item",
                "@title": "Tennis News",
                "@url": "",
                ">": [{
                  "@tag": "item",
                  "@title": "Sports News",
                  "@url": ""
                }, {
                  "@tag": "item",
                  "@title": "Football News",
                  "@url": ""
                }, {
                  "@tag": "item",
                  "@title": "BasketBall News",
                  "@url": ""
                }, {
                  "@tag": "item",
                  "@title": "Golf News",
                  "@url": ""
                }, {
                  "@tag": "item",
                  "@title": "Tennis News",
                  "@url": ""
                }]
              }]
            }]
          }, {
            "@tag": "item",
            "@title": "BasketBall News",
            "@url": ""
          }, {
            "@tag": "item",
            "@title": "Golf News",
            "@groupName": "External",
            "@url": ""
          }, {
            "@tag": "item",
            "@title": "Tennis News",
            "@groupName": "Sports",
            "@url": ""
          }, {
            "@tag": "item",
            "@title": "Waterball News",
            "@groupName": "External",
            "@url": "",
            ">": [{
              "@tag": "item",
              "@title": "Football News",
              "@url": ""
            }, {
              "@tag": "item",
              "@title": "BasketBall News",
              "@url": ""
            }, {
              "@tag": "item",
              "@title": "Golf News",
              "@url": ""
            }, {
              "@tag": "item",
              "@title": "Tennis News",
              "@url": "",
              ">": [{
                "@tag": "item",
                "@title": "Football News",
                "@url": ""
              }, {
                "@tag": "item",
                "@title": "BasketBall News",
                "@url": ""
              }, {
                "@tag": "item",
                "@title": "Golf News",
                "@url": ""
              }]
            }]
          }]
        }, {
          "@tag": "item",
          "@title": "About",
          "@iconOnly": "true | false",
          "@iconName": "",
          "@iconPosition": "left",
          "@active": false,
          "@url": ""
        }, {
          "@tag": "item",
          "@title": "searchBar"
        }]
      }]
    }
    return jsonData;
  }

  render(node) {

    let uiDiv = document.createElement('div');
    uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);
    uiDiv.className = "ui menu";

    const dropdownIds = [];

    // Iterate groups

    for (const group of this.data['>']) {

      for (let item of group['>']) {

        if (item['@tag'] != 'item') {
          // Render external component
          // Note: This is not fleshed out yet

          return;
        }
        let itemContainer;

        if (!item['>']) {

          itemContainer = document.createElement("a");
          //Todo: Add logic to handling item action
          itemContainer.className = "item";

          this.renderChildren(itemContainer, item);
        } else {

          itemContainer = document.createElement("div");
          itemContainer.className = 'ui pointing dropdown link item';

          // Generate unique dropdown id
         const id =  uiDiv.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);
         dropdownIds.push('#' + id);
         itemContainer.setAttribute("id", id);

          this.renderChildren(itemContainer, item, false);
        }

        // Todo: Based on horizontal orientation, set CSS alignment

        itemContainer.style.float = group['@position'];
        uiDiv.appendChild(itemContainer);
      }

    }

    node.append(uiDiv);
    console.log(dropdownIds);
    $(dropdownIds.join(','))
      .dropdown({
        on: 'hover',
        allowTab: false
      });
  }

  getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  renderChildren(parentNode, item, recursive) {

    if (!item['>'] || (!item['>'].length)) {
      parentNode.appendChild(document.createTextNode(item['@title']));
      return;
    }

    const titleSpan = document.createElement('span');
    titleSpan.innerHTML = item['@title'];
    titleSpan.className = 'text';

    const iTag = document.createElement('i');
    iTag.className = 'dropdown icon';

    if (!recursive) {
      // This is a direct navbar item
      parentNode.appendChild(titleSpan);
      parentNode.appendChild(iTag);
    } else {
      // This is a navbar subitem (at any given hierarchy)
      parentNode.appendChild(iTag);
      parentNode.appendChild(titleSpan);
    }

    const menuDiv = document.createElement("div");
    menuDiv.className = 'menu';

    let firstGroup = true;

    for (const group of this.getGroups(item['>']).entries()) {

      // Firs, render group name

      if (group[0]) {

        if (!firstGroup) {
          // Add divider
          const dividerDiv = document.createElement("div");
          dividerDiv.className = "divider";
          menuDiv.appendChild(dividerDiv);
        }

        // Add group title
        const groupHeaderDiv = document.createElement('div');
        groupHeaderDiv.className = "header";
        groupHeaderDiv.innerHTML = group[0];

        menuDiv.appendChild(groupHeaderDiv);
      }

      for (const subItem of group[1]) {

        const itemDiv = document.createElement("div");
        itemDiv.className = "item";

        this.renderChildren(itemDiv, subItem, true);

        menuDiv.appendChild(itemDiv);
      }

      firstGroup = false;
    }

    parentNode.appendChild(menuDiv);
  }

  /**
   * This method returns a collection of groups
   * @param {Array{String}} itemsArray 
   * @returns Map
   */
  getGroups(itemsArray) {
    const DEFAULT_GROUP = "";
    // First, we need to process itemArray into groups
    const groupNames = [...new Set(itemsArray.map(i => i['@groupName'] || DEFAULT_GROUP))];
    const groups = new Map();
    groupNames.forEach(name => {
      groups.set(name, []);
    });

    itemsArray.forEach(subItem => {
      groups.get(subItem['@groupName'] || DEFAULT_GROUP).push(subItem);
    });
    return groups;
  }

}




//toggle active and inactive
$('.ui.menu a.item').on('click', function () {
  $(this)
    .addClass('active')
    .siblings()
    .removeClass('active');
})

class NavBar extends BaseComponent {

  constructor() {
    super();
    this.data = this.getJson();// This is only a prototype
  }

  tagName() {
    return "navbar";
  }

  getCssDependencies() {
    const baseDependencies = super.getCssDependencies();
    baseDependencies.push('/css/dropdown.css', '/css/icons.css', '/shared/css/extra_colors.css', '/shared/css/ionicons.css');
    return baseDependencies
  }

  getjsDependencies() {
    const baseDependencies = super.getCssDependencies();
    baseDependencies.push();
    return baseDependencies;
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
          "@badge": 5,
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
              "@url": "",
              "@badge": 3
            }, {
              "@tag": "item",
              "@title": "Tennis News",
              "@url": "",
              ">": [{
                "@tag": "item",
                "@title": "Sports News",
                "@url": "",
                "@badge": 1,
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
                  "@badge": 2,
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
            "@url": "",
            "@badge": 9,
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
        }]
      }]
    }
    return jsonData;
  }

  render(node) {

    let uiDiv = document.createElement('div');
    uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);
    uiDiv.className = "ui";

    if (this.data["@orientation"] === "vertical") {
      uiDiv.classList.add("vertical");
    }

    // Iterate groups

    const dropdownIds = [];

    for (const group of this.data['>']) {

      let isFirstNode = true;

      for (let item of group['>']) {

        let itemContainer;

        if (item['@tag'] != 'item') {
          // Render external component
          // Note: This is not fleshed out yet



        } else {

          if (!item['>']) {

            itemContainer = document.createElement("a");
            //Todo: Add logic to handling item action
            itemContainer.className = "item";

            this.renderChildren(itemContainer, item);
          } else {

            itemContainer = document.createElement("div");
            itemContainer.className = 'ui pointing dropdown link item';

            if (this.data["@orientation"] === "vertical") {
              itemContainer.classList.add("left");
            }

            // Generate unique dropdown id
            const id = uiDiv.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);
            dropdownIds.push('#' + id);
            itemContainer.setAttribute("id", id);

            this.renderChildren(itemContainer, item, false);
          }

        }

        if (this.data["@orientation"] === "horizontal") {
          // Todo: Based on horizontal orientation, set CSS alignment
          switch (group['@position']) {
            case 'center':

              break;
            case 'left':
            case 'right':
              itemContainer.style.float = group['@position'];
              console.log(isFirstNode);
              if (isFirstNode && group['@position'] === 'right') {
                itemContainer.style.marginLeft = 'auto';
              }
              break;
          }
        }

        if (isFirstNode) {
          isFirstNode = false;
        }

        uiDiv.appendChild(itemContainer);
      }

    }
    uiDiv.classList.add("menu");

    node.append(uiDiv);

    $(dropdownIds.join(','))
      .dropdown({
        on: 'hover',
        allowTab: false,
        action: "nothing"
      });
  }

  // getRandomInt = (min, max) => {
  //   min = Math.ceil(min);
  //   max = Math.floor(max);
  //   return Math.floor(Math.random() * (max - min + 1)) + min;
  // }

  renderChildren(parentNode, item, recursive) {

    if (!item['>'] || (!item['>'].length)) {
      parentNode.appendChild(document.createTextNode(item['@title']));

      // Create badge, if availble
      if (item['@badge']) {
        const badgeDiv = document.createElement("div");
        badgeDiv.innerHTML = item['@badge'];
        badgeDiv.className = 'ui teal left label';

        parentNode.appendChild(badgeDiv);
      }
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




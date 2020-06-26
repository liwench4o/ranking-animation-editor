import '../css/style.css';
import _ from 'lodash';

function component() {
    const element = document.createElement('div');
    element.innerHTML = _.join(['kobe', 'cpul'], ' ');
    element.classList.add('hello');
    return element;
}

document.body.appendChild(component());
